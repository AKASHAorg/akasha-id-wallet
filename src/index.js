const Signalhub = require('signalhub') // might switch to SocketCluster later
const BroadcastChannel = require('broadcast-channel').default
const LeaderElection = require('broadcast-channel/leader-election')
const generateId = require('./utils').generateId
const crypto = require('./crypto')

const APP_NAME = 'AKASHA'
const HUB_URLS = ['localhost:8080']
const WALLET_URL = 'http://localhost:3000'

let DEBUGGING = false

// enable/disable debug
function debug () {
  if (DEBUGGING) {
    console.log.apply(this, arguments)
  }
}

// Initialize the signalhub connection
const initHub = (hubUrls) => {
  const hub = Signalhub(APP_NAME, hubUrls)
  // catch errors
  hub.on('error', ({ url, error }) => {
    throw (new Error('Connection error', url, error))
  })
  return hub
}

class DIDclient {
  /**
    * Class constructor
    *
    * @param {Object} appInfo - An object containing app info to be used in the
    * registration process
    * @param {Object} options - Configuration options
    */
  constructor (appInfo, options = {}) {
    if (!appInfo) {
      throw new Error('Missing app details. Got:', appInfo)
    }
    this.appInfo = appInfo
    // init config
    this.config = {
      hubUrls: options.hubUrls ? options.hubUrls : HUB_URLS,
      walletUrl: options.walletUrl ? options.walletUrl : WALLET_URL
    }
    // debug
    DEBUGGING = options.debug ? options.debug : false
  }

  /**
    * Generate a special link to request access to the user's DID
    *
    * @returns {string} - A formatted link containing the necessary info to register the app
    */
  async registrationLink () {
    // generate a one time channel ID
    this.loginChannel = generateId()
    // generate NONCE
    this.nonce = this.genNonce()
    // generate a one time symmetric encryption key and reveal it to AKASHA.id
    this.bootstrapKey = await crypto.genAESKey(true, 'AES-GCM', 128)
    const extractedKey = await crypto.exportKey(this.bootstrapKey)
    const b64Key = Buffer.from(extractedKey).toString('base64')
    // use the wallet app URL for the link
    const loginUrl = new URL(this.config.walletUrl)
    const hashParams = JSON.stringify([this.loginChannel, b64Key, this.nonce])
    loginUrl.hash = '/link/' + Buffer.from(hashParams).toString('base64')

    this.loginLink = loginUrl.href
    return this.loginLink
  }

  // Generate a none
  genNonce (min, max) {
    min = Math.ceil(min || 100000)
    max = Math.floor(max || 9999999)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
    * Bootstrap the login process by creating a listener that also handles
    * message exchanges for app registration
    *
    * @returns {Promise<Object>} - The response from the IDP, may contain a claim if
    * the app was allowed (i.e. if msg.allowed is true)
    */
  async requestProfile () {
    if (!this.loginLink) {
      await this.registrationLink()
    }
    return new Promise((resolve, reject) => {
      try {
        const hub = initHub(this.config.hubUrls)
        hub.subscribe(this.loginChannel).on('data', async (data) => {
          data = JSON.parse(data)
          if (data.request === 'reqInfo') {
            const msg = await crypto.decrypt(this.bootstrapKey, data.msg, 'base64')
            if (msg.nonce && msg.nonce === this.nonce) {
              // the AKASHA.id app is requesting app details
              const encKey = await crypto.importKey(msg.encKey)
              // genereate new key
              // generate a one time symmetric encryption key and reveal it to AKASHA.id
              this.bootstrapKey = await crypto.genAESKey(true, 'AES-GCM', 128)
              const exportedKey = await crypto.exportKey(this.bootstrapKey)
              const b64Key = Buffer.from(exportedKey).toString('base64')
              const encryptedMsg = await crypto.encrypt(encKey, {
                token: msg.token,
                nonce: msg.nonce,
                appInfo: this.appInfo,
                key: b64Key
              }, 'base64')
              hub.broadcast(this.loginChannel, JSON.stringify({ request: 'appInfo', msg: encryptedMsg }))
            }
          } else if (data.request === 'claim') {
            const msg = await crypto.decrypt(this.bootstrapKey, data.msg, 'base64')
            if (msg.nonce && msg.nonce === this.nonce) {
              resolve(msg)
              debug('Got response:', msg)
              this.cleanUp(hub)
            }
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  /**
    * Request an updated claim for the user
    *
    * @param {string} channel - The channel to be used for requests
    * @param {string} token - The application token to send
    * @param {string} rawKey - The encryption key to use for the request message
    * @returns {Promise<Object>} - The refreshed profile claim
    */
  async refreshProfile (channel, token, rawKey) {
    if (!channel || !token || !rawKey) {
      debug('refreshProfile:', channel, token, rawKey)
      throw new Error('You need to provide each of channel ID, app token, and encryption key for the request.')
    }
    try {
      debug('Refreshing profile using:', channel, token, rawKey)
      // prepare request
      const key = await crypto.importKey(rawKey)
      // encrypt message to be sent
      const nonce = this.genNonce()
      const updateChannel = generateId()
      const encryptedMsg = await crypto.encrypt(key, {
        nonce: nonce,
        channel: updateChannel
      }, 'base64')
      // set up listener
      return new Promise((resolve, reject) => {
        const updateHub = initHub(this.config.hubUrls)
        try {
          updateHub.subscribe(updateChannel).on('data', async (data) => {
            data = JSON.parse(data)
            if (data.request === 'claim') {
              const msg = await crypto.decrypt(key, data.msg, 'base64')
              if (msg.nonce === nonce) {
                resolve(msg)
                this.cleanUp(updateHub)
              }
            }
          })
          // also broadcast request
          updateHub.broadcast(channel, JSON.stringify({ request: 'refresh', token, msg: encryptedMsg }))
        } catch (e) {
          reject(e)
          this.cleanUp(updateHub)
        }
      })
    } catch (e) {
      debug(e)
      throw new Error(e)
    }
  }

  /**
    * Clean up the current request state and close the hub connection
    *
    * @param {Object} hub - The hub object
    */
  cleanUp (hub) {
    this.loginChannel = null
    this.loginLink = null
    this.nonce = null
    hub.close()
  }
}

class DIDwallet {
  /**
    * Class constructor
    *
    * @param {string} id - A unique indetifier for the current user
    * @param {Object} options - Configuration options
    */
  constructor (id, options = {}) {
    // init config
    this.id = id || generateId()
    this.did = `did:akasha:${this.id}`
    this.hubUrls = options.hubUrls ? options.hubUrls : HUB_URLS

    // debug
    DEBUGGING = options.debug ? options.debug : false
  }

  /**
    * Initiate the listener
    *
    * @param {Function} refreshHandler - The handler function to trigger in case of a
    * refresh request
    */
  init (refreshHandler) {
    // only listen if we're master
    // initiate the elector process
    const electorChannel = new BroadcastChannel(APP_NAME)
    const elector = LeaderElection.create(electorChannel)
    elector.awaitLeadership().then(() => {
      debug('This window is master -> now listening to refresh requests.')
      this.listen(refreshHandler)
    })
  }

  // Return the current DID
  did () {
    return this.did
  }

  /**
    * Parse a base64 encoded login link
    *
    * @param {string} str - A base64-encoded registration string, contaning channelId,
    * encryption key, nonce
    * @returns {Object} - The parsed data
    */
  parseRegisterLink (str) {
    const decoded = Buffer.from(str, 'base64')
    try {
      const data = JSON.parse(decoded) // eslint-disable-line
      const parsed = {
        channel: data[0],
        key: data[1],
        nonce: data[2]
      }
      return parsed
    } catch (e) {
      console.error(e, decoded)
    }
  }

  /**
    * Listener for 'refresh' requests coming from registered apps
    *
    * @param {Function} handler - The handler function to trigger in case of a
    * refresh request
    */
  async listen (refreshHandler) {
    // init query hub
    const hub = initHub(this.hubUrls)
    try {
      hub.subscribe(this.id).on('data', async (data) => {
        data = JSON.parse(data)
        switch (data.request) {
          case 'refresh':
            refreshHandler(data)
            break
          default:
            break
        }
      })
    } catch (e) {
      debug(e)
    }
  }

  /**
    * Set up an initial exchange to receive app information
    *
    * @param {Object} data - A base64-encoded string containing an encryption key, a nonce
    * and a channelID to bootstrap the registration process
    * @returns {Promise<Object>} - The application token and data to be stored by the wallet app
    */
  async registerApp (data) {
    // parse the request data from the client
    let req
    try {
      req = this.parseRegisterLink(data)
    } catch (e) {
      throw new Error(e)
    }
    // init hub connection
    const hub = initHub(this.hubUrls)
    if (!req || !req.channel || !req.key || !req.nonce) {
      throw new Error('Missing required paramaters when calling registeApp.')
    }
    // import encryption key
    const key = await crypto.importKey(req.key)
    // generate a unique token for the app
    const token = generateId()
    // generate a symmetric encryption key for this app
    const newKey = await crypto.genAESKey(true, 'AES-GCM', 128)
    const expKey = await crypto.exportKey(newKey)
    const encKey = Buffer.from(expKey).toString('base64')
    // encrypt reply message
    const encryptedMsg = await crypto.encrypt(key, {
      token,
      encKey,
      nonce: req.nonce
    }, 'base64')
    // set up listener
    return new Promise((resolve, reject) => {
      try {
        hub.subscribe(req.channel).on('data', async (data) => {
          data = JSON.parse(data)
          if (data.request === 'appInfo') {
            const msg = await crypto.decrypt(newKey, data.msg, 'base64')
            if (msg.token === token) {
              // add channel
              msg.channel = req.channel
              try {
                resolve(msg)
              } catch (e) {
                debug(e)
              }
              this.cleanUp(hub)
            }
          }
        })
        // also broadcast request
        hub.broadcast(req.channel, JSON.stringify({ request: 'reqInfo', msg: encryptedMsg }))
      } catch (e) {
        reject(e)
        this.cleanUp(hub)
      }
    })
  }

  /**
    * Send a claim with profile attributes
    *
    * @param {Object} req - The request coming from the client app
    * @param {Object} attributes - An object containing profile attributes
    * @param {string} [mode] - The mode of the key to import (default 'AES-GCM')
    * @returns {Promise<Object>} - The data used for the claim once it has been sent,
    * to be stored by the wallet app
    */
  async sendClaim (req, attributes, allowed) {
    // init hub connection
    const hub = initHub(this.hubUrls)
    if (!req || !req.channel || !req.key || !req.nonce) {
      throw new Error('Missing required paramaters when calling sendClaim. Got:', req)
    }
    // import encryption key
    const key = await crypto.importKey(req.key)
    // generate a unique token for the app
    const token = req.token || generateId()
    // generate a symmetric encryption key for this app
    const newKey = await crypto.exportKey(await crypto.genAESKey(true, 'AES-GCM', 128))
    const refreshEncKey = Buffer.from(newKey).toString('base64')
    // encrypt reply message
    const msg = {
      allowed,
      nonce: req.nonce
    }
    if (allowed) {
      msg.claim = this.newClaim(attributes)
      msg.token = token
      msg.refreshEncKey = refreshEncKey
    }
    const encryptedMsg = await crypto.encrypt(key, msg, 'base64')
    // broadcast msg back to the app
    return new Promise((resolve) => {
      hub.broadcast(req.channel, JSON.stringify({ request: 'claim', msg: encryptedMsg }), () => {
        // resolve promise in order to store app settings if we allowed it
        if (allowed) {
          resolve({
            token,
            refreshEncKey,
            attributes
          })
        }
        // cleanup
        this.cleanUp(hub)
      })
    })
  }

  // TODO: decide if we continue to use VCs or not
  newClaim (attributes) {
    if (!attributes.id) {
      attributes.id = this.did
    }
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://schema.org/'],
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuer: this.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: attributes,
      proof: {}
    }
  }

  /**
    * Clean up the current request state and close the hub connection
    *
    * @param {Object} hub - The hub object
    */
  cleanUp (hub) {
    hub.close()
    debug('Closed hub')
  }
}

module.exports = {
  DIDclient,
  DIDwallet,
  generateId,
  crypto
}
