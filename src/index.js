const signalhub = require('signalhub')
const generateId = require('./utils').generateId
const crypto = require('masq-common').crypto

const HUB_URLS = [ 'localhost:8080' ]
const WALLET_URL = 'http://localhost:3000'


// Initialize the signalhub connection
const initHub = (channel, hubUrls) => {
  const hub = signalhub(channel, hubUrls)
  // catch errors
  hub.on('error', ({ url, error }) => {
    throw(new Error('Websocket connection error', url, error))
  })
  return hub
}

class DIDclient {
    constructor (appName, appDescription, appImageURL, appURL, options = {}) {
      this.appName = appName
      this.appDescription = appDescription
      this.appImageURL = appImageURL
      this.appURL = appURL
      // prepare hub
      this.hub = undefined
      
      // init config
      this.config = {
        hubUrls: options.hubUrls ? options.hubUrls : HUB_URLS,
        walletBaseUrl: options.walletBaseUrl ? options.walletBaseUrl : WALLET_URL
      }
    }

    // Initialize the signalhub connection
    // initHub (channel) {
    //   const hub = signalhub(channel, this.config.hubUrls)
    //   // catch errors
    //   hub.on('error', ({ url, error }) => {
    //     throw(new Error('Websocket connection error', url, error))
    //   })
    //   return hub
    // }

    // Generate a special link to request access to the user's DID
    async genLoginLink () {
      // generate a one time channel ID
      this.loginChannel = generateId()
      // generate a one time symmetric encryption key and reveal it to AKASHA.id
      this.bootstrapKey = await crypto.genAESKey(true, 'AES-GCM', 128)
      const extractedKey = await crypto.exportKey(this.bootstrapKey)
      const b64Key = Buffer.from(extractedKey).toString('base64')
      // use the wallet app URL for the link
      const loginUrl = new URL(this.config.walletBaseUrl)
      const hashParams = JSON.stringify([this.appName, this.loginChannel, b64Key])
      console.log(hashParams)
      loginUrl.hash = '/link/' + Buffer.from(hashParams).toString('base64')
  
      this.loginLink = loginUrl.href
      return this.loginLink
    }

    /*  Bootstrap the login process.
     *  @param {function} success Function to call when the process succeeds
     *  @param {function} fail Function to call when the process fails
     */
    async bootstrapNewLogin (success, fail) {
      if (!this.loginLink) {
        await this.genLoginLink()
      }

      try {
        const hub = initHub(this.loginChannel, this.config.hubUrls)
        hub.subscribe(this.loginChannel).on('data', async (data) => {
          const msg = await crypto.decrypt(this.bootstrapKey, JSON.parse(data), 'base64')
          switch (msg.status) {
            case 'allowed':
              success(msg)
              break
            case 'denied':
              fail(msg)
              break
            default:
              throw new Error(`Unexpectedly received message with status ${msg.status}`)
          }
        })
      } catch (e) {
        console.error(e)
      }
    }

    async acceptedLogin (claim) {
      // TODO verify claim
      console.log('Login accepted', claim)
      this.claim = claim
    }

    async rejectedLogin () {
      console.log('Login rejected')
    }
}

class DIDwallet {
  constructor (hubUrls) {
    // init config
    this.config = {
      hubUrls: hubUrls ? hubUrls : HUB_URLS
    }
    this.did = `did:akasha:${generateId()}`
  }

  // Parse a base64 encoded login link
  parseLoginLink (hash) {
    const decoded = Buffer.from(hash, 'base64')

    try {
      return JSON.parse(decoded) // eslint-disable-line
    } catch (e) {
      console.error(e)
    }
  }

  async respondToLogin (rawKey, channel, claim, status) {
    // init Websocket hub connection
    const hub = initHub(channel, this.config.hubUrls)
    // encrypt payload
    const key = await crypto.importKey(Buffer.from(rawKey, 'base64'))
    const encryptedMsg = await crypto.encrypt(key, {status, claim}, 'base64')

    hub.broadcast(channel, JSON.stringify(encryptedMsg))
    hub.close()
  }
}

module.exports = {
  DIDclient,
  DIDwallet,
  generateId
}
