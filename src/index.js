const signalhub = require('signalhub') // might switch to SocketCluster later
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
  const hub = signalhub(APP_NAME, hubUrls)
  // catch errors
  hub.on('error', ({ url, error }) => {
    throw (new Error('Connection error', url, error))
  })
  return hub
}

class DIDclient {
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

  // Generate a special link to request access to the user's DID
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

  /*  Bootstrap the login process.
    *  @param {function} success Function to call when the process succeeds
    *  @param {function} fail Function to call when the process fails
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
              const encKey = await crypto.importKey(Buffer.from(msg.encKey, 'base64'))
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

  // request an updated claim for the user
  async refreshProfile (channel, token, rawKey) {
    if (!channel || !token || !rawKey) {
      debug('refreshProfile:', channel, token, rawKey)
      throw new Error('You need to provide each of channel ID, app token, and encryption key for the request.')
    }
    try {
      debug('Refreshing profile using:', channel, token, rawKey)
      // prepare request
      const key = await crypto.importKey(Buffer.from(rawKey, 'base64'))
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

  // Clean up the current request state and close the hub connection
  cleanUp (hub) {
    this.loginChannel = null
    this.loginLink = null
    this.nonce = null
    hub.close()
  }
}

class DIDwallet {
  constructor (options = {}) {
    // init config
    this.config = {}
    this.config.id = generateId()
    this.config.did = `did:akasha:${this.config.id}`
    this.store = options.store || window.localStorage
    // load persistent config if available
    try {
      const prev = JSON.parse(this.store.getItem('config'))
      if (prev) {
        this.config = prev
      }
    } catch (e) {
      debug(e)
    }
    this.config.hubUrls = options.hubUrls ? options.hubUrls : HUB_URLS

    // save config if changed
    this.store.setItem('config', JSON.stringify(this.config))
    // debug
    DEBUGGING = options.debug ? options.debug : false
  }

  init () {
    this.listen()
  }

  // Return the user's DID
  did () {
    return this.config.did
  }

  // Parse a base64 encoded login link
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

  async handleRefresh (data) {
    try {
      const localData = JSON.parse(this.store.getItem(data.token))
      if (!localData) {
        // TODO: handle revoked apps
        return
      }
      const key = await crypto.importKey(Buffer.from(localData.key, 'base64'))
      const req = await crypto.decrypt(key, data.msg, 'base64')
      debug('Got refresh request:', req)
      await this.sendClaim({
        channel: req.channel,
        token: data.token,
        key: localData.key,
        nonce: req.nonce
      },
      localData.attributes,
      true)
    } catch (e) {
      debug(e)
    }
  }

  async listen () {
    // init query hub
    const hub = initHub(this.config.hubUrls)
    try {
      hub.subscribe(this.config.id).on('data', async (data) => {
        data = JSON.parse(data)
        switch (data.request) {
          case 'refresh':
            this.handleRefresh(data)
            break
          default:
            break
        }
      })
    } catch (e) {
      debug(e)
    }
  }

  // set up an initial exchange to receive app information
  async registerApp (data) {
    // parse the request data from the client
    let req
    try {
      req = this.parseRegisterLink(data)
    } catch (e) {
      throw new Error(e)
    }
    // init hub connection
    const hub = initHub(this.config.hubUrls)
    if (!req || !req.channel || !req.key || !req.nonce) {
      throw new Error('Missing required paramaters when calling registeApp.')
    }
    // import encryption key
    const key = await crypto.importKey(Buffer.from(req.key, 'base64'))
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
              resolve(msg)
              try {
                await this.addApp(msg.token, msg.appInfo)
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

  async sendClaim (req, attributes, allowed, cb) {
    // init hub connection
    const hub = initHub(this.config.hubUrls)
    if (!req || !req.channel || !req.key || !req.nonce) {
      throw new Error('Missing required paramaters when calling sendClaim. Got:', req)
    }
    // import encryption key
    const key = await crypto.importKey(Buffer.from(req.key, 'base64'))
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
    hub.broadcast(req.channel, JSON.stringify({ request: 'claim', msg: encryptedMsg }), () => {
      // save app settings if we allowed it
      if (allowed) {
        this.storeClaim(token, refreshEncKey, attributes)
      }
      // cleanup
      this.cleanUp(hub)
      // callback
      if (cb) {
        cb()
      }
    })
  }

  newClaim (attributes) {
    if (!attributes.id) {
      attributes.id = this.config.did
    }
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://schema.org/'],
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuer: this.config.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: attributes,
      proof: {}
    }
  }

  async storeClaim (token, key, attributes, cb) {
    this.store.setItem(token, JSON.stringify({
      key: key,
      attributes: attributes
    }))
    if (cb) {
      cb()
    }
  }

  async addApp (token, appInfo) {
    if (!token || !appInfo) {
      throw new Error(`Missing parameter when adding app: ${token}, ${JSON.stringify(appInfo)}`)
    }
    if (!this.store.getItem(token)) {
      try {
        const apps = JSON.parse(this.store.getItem('apps')) || {}
        apps[token] = appInfo
        this.store.setItem('apps', JSON.stringify(apps))
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  async removeApp (appToken) {
    if (this.store.getItem(appToken)) {
      // remove claim
      this.store.removeItem(appToken)
      // also remove app from list
      try {
        const apps = JSON.parse(this.store.getItem('apps'))
        delete apps[appToken]
        this.store.setItem('apps', JSON.stringify(apps))
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  async listApps () {

  }

  // Clean up the current request state and close the hub connection
  cleanUp (hub) {
    hub.close()
    debug('Closed hub')
  }
}

module.exports = {
  DIDclient,
  DIDwallet
}
