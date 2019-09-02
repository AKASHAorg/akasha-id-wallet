const Signalhub = require('signalhub') // might switch to SocketCluster later
const BroadcastChannel = require('broadcast-channel').default
const LeaderElection = require('broadcast-channel/leader-election')
const SecureStore = require('secure-store')
const WebCrypto = require('web-crypto')

const APP_NAME = 'AKASHA'

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

class Client {
  /**
    * Class constructor
    *
    * @param {Object} appInfo - An object containing app info to be used in the
    * registration process
    * @param {Object} config - Configuration options
    */
  constructor (appInfo, config = {}) {
    if (!appInfo) {
      throw new Error('Missing app details')
    }
    this.appInfo = appInfo

    // init config
    if (!config || !config.hubUrls || !config.walletUrl) {
      throw new Error('Missing config details')
    }
    this.config = config
    // debug
    DEBUGGING = config.debug ? config.debug : false
  }

  /**
    * Generate a special link to request access to the user's DID
    *
    * @returns {string} - A formatted link containing the necessary info to register the app
    */
  async registrationLink () {
    // generate a one time channel ID
    this.loginChannel = WebCrypto.genId()
    // generate NONCE
    this.nonce = this.genNonce()
    // generate a one time symmetric encryption key and reveal it to AKASHA.id
    this.bootstrapKey = await WebCrypto.genAESKey(true, 'AES-GCM', 128)
    const extractedKey = await WebCrypto.exportKey(this.bootstrapKey)
    const b64Key = Buffer.from(extractedKey).toString('base64')

    // use the wallet app URL for the link
    const hashParams = JSON.stringify([this.loginChannel, b64Key, this.nonce])
    this.loginLink = this.config.walletUrl + Buffer.from(hashParams).toString('base64')
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
            const msg = await WebCrypto.decrypt(this.bootstrapKey, data.msg, 'base64')
            if (msg.nonce && msg.nonce === this.nonce) {
              // the AKASHA.id app is requesting app details
              const encKey = await WebCrypto.importKey(Buffer.from(msg.encKey, 'base64'))
              // genereate new key
              // generate a one time symmetric encryption key and reveal it to AKASHA.id
              this.bootstrapKey = await WebCrypto.genAESKey(true, 'AES-GCM', 128)
              const exportedKey = await WebCrypto.exportKey(this.bootstrapKey)
              const b64Key = Buffer.from(exportedKey).toString('base64')
              const encryptedMsg = await WebCrypto.encrypt(encKey, {
                token: msg.token,
                nonce: msg.nonce,
                appInfo: this.appInfo,
                key: b64Key
              }, 'base64')
              hub.broadcast(this.loginChannel, JSON.stringify({ request: 'appInfo', msg: encryptedMsg }))
            }
          } else if (data.request === 'claim') {
            const msg = await WebCrypto.decrypt(this.bootstrapKey, data.msg, 'base64')
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
  async refreshProfile (claim) {
    if (!claim.did || !claim.token || !claim.refreshEncKey) {
      debug('refreshProfile:', claim.did, claim.token, claim.refreshEncKey)
      throw new Error('You need to provide each of channel ID, app token, and encryption key for the request.')
    }
    try {
      // get refresh channel from the user's DID by stripping 'did:akasha:'
      const channel = this.getChannelFromDID(claim.did)
      debug('Refreshing profile using:', channel, claim.token, claim.refreshEncKey)
      // prepare request
      const key = await WebCrypto.importKey(Buffer.from(claim.refreshEncKey, 'base64'))
      // encrypt message to be sent
      const nonce = this.genNonce()
      const updateChannel = WebCrypto.genId()
      const encryptedMsg = await WebCrypto.encrypt(key, {
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
              const msg = await WebCrypto.decrypt(key, data.msg, 'base64')
              if (msg.nonce === nonce) {
                resolve(msg)
                this.cleanUp(updateHub)
              }
            }
          })
          // also broadcast request
          const toSend = {
            request: 'refresh',
            token: claim.token,
            msg: encryptedMsg
          }
          debug('Sending refresh req:', toSend)
          updateHub.broadcast(channel, JSON.stringify(toSend))
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
    * Return the channel ID from a DID
    *
    * @param {string} did - The user's DID
    * @returns {string} - The channel ID
    */
  getChannelFromDID (did) {
    return did.split(':')[2]
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

class Wallet {
  /**
    * Class constructor
    *
    * @param {string} id - A unique indetifier for the current user
    * @param {Object} config - Configuration options
    */
  constructor (config = {}) {
    // load persistent config if available
    this.conf = {}
    if (!config || !config.hubUrls) {
      throw new Error('Missing config details')
    }
    this.hubUrls = config.hubUrls
    // debug
    DEBUGGING = config.debug ? config.debug : false
  }

  /**
   * Initialize the Wallet by loading all the profile IDs
   */
  async init () {
    try {
      this.profiles = await SecureStore._idb.get('profiles')
      if (!this.profiles) {
        this.profiles = {}
      }
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
    * Sign up a user
    *
    * @param {string} name - The profile name
    * @param {string} passphrase - The user's passphrase
    * @returns {string} id - The id specific to the new profile
    */
  async signup (name, passphrase) {
    if (!name || !passphrase) {
      throw new Error('Both profile name and password are required')
    }
    // TODO: should use key derivation for future proof of ownership when
    // generating a new ID
    this.id = WebCrypto.genId()
    // add this user to the local list of available accounts
    await this.updateProfileList(this.id, {
      name
    })
    // also log user in
    await this.login(this.id, passphrase)
    return this.id
  }

  /**
    * Log a user into a specific profile
    *
    * @param {string} userId - The user identifier
    * @param {string} passphrase - The user's passphrase
    */
  async login (userId, passphrase) {
    try {
      this.id = userId
      this.did = `did:akasha:${this.id}`
      this.store = new SecureStore.Store(this.id, passphrase)
      await this.store.init()

      // only listen if we're master
      // initiate the elector process
      const electorChannel = new BroadcastChannel(APP_NAME)
      this.elector = LeaderElection.create(electorChannel)
      this.elector.awaitLeadership().then(() => {
        debug('This window is master -> now listening to refresh requests.')
        this.listen()
      })
    } catch (e) {
      throw new Error(e.message)
    }
  }

  /**
   * Log an user out of a specific profile
   */
  async logout () {
    if (this.hub) await this.cleanUp(this.hub)
    if (this.elector) await this.elector.die()
    this.elector = undefined
    this.hub = undefined
    this.id = undefined
    this.did = undefined
    this.store = undefined
  }

  /**
   * Return the current list of profiles
   */
  publicProfiles () {
    const profiles = []
    const ids = Object.keys(this.profiles)
    if (ids.length === 0) {
      return profiles
    }
    ids.forEach(id => {
      profiles.push({
        id,
        name: this.profiles[id].name,
        picture: this.profiles[id].picture
      })
    })
    return profiles
  }

  /**
    * Update the list of profiles for a given userID
    *
    * @param {string} userId - The user identifier
    * @param {Object} data - The user's (public) profile that is used when
    * building the list
    * @returns {Promise} - The promise that resolves upon successful completion of the
    * data store operation
    */
  async updateProfileList (userId, data) {
    if (!data.name) {
      throw new Error('Missing name from profile')
    }
    try {
      this.profiles[userId] = {
        name: data.name,
        picture: data.picture || undefined
      }
      await SecureStore._idb.set('profiles', this.profiles)
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * Remove a local user profile
   *
   * @param {string} The user's profile ID
   */
  async removeProfile (id) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    try {
      delete this.profiles[id]
      await SecureStore._idb.set('profiles', this.profiles)
    } catch (e) {
      throw new Error(e)
    }
    await this.store.clear()
    // TODO: remove the db and store (needs upstream implementation in idbkeyval)
    await this.logout()
  }

  /**
    * Listener for 'refresh' requests coming from registered apps
    *
    * @param {Function} handler - The handler function to trigger in case of a
    * refresh request
    */
  async listen (refreshHandler) {
    // init query hub
    this.hub = initHub(this.hubUrls)
    try {
      this.hub.subscribe(this.id).on('data', async (data) => {
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
      throw new Error(e)
    }
  }

  async handleRefresh (data) {
    try {
      const localData = await this.store.get(data.token)
      if (!localData) {
        // TODO: handle revoked apps
        return
      }
      const key = await WebCrypto.importKey(Buffer.from(localData.key, 'base64'))
      const req = await WebCrypto.decrypt(key, data.msg, 'base64')
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

  /**
    * Set up an initial exchange to receive app information
    *
    * @param {Object} data - A base64-encoded string containing an encryption key, a nonce
    * and a channelID to bootstrap the registration process
    * @returns {Promise<Object>} - The application token and data to be stored by the wallet app
    */
  async registerApp (data) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
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
    const key = await WebCrypto.importKey(Buffer.from(req.key, 'base64'))
    // generate a unique token for the app
    const token = WebCrypto.genId()
    // generate a symmetric encryption key for this app
    const newKey = await WebCrypto.genAESKey(true, 'AES-GCM', 128)
    const expKey = await WebCrypto.exportKey(newKey)
    const encKey = Buffer.from(expKey).toString('base64')
    // encrypt reply message
    const encryptedMsg = await WebCrypto.encrypt(key, {
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
            const msg = await WebCrypto.decrypt(newKey, data.msg, 'base64')
            if (msg.token === token) {
              // add channel
              msg.channel = req.channel
              this.cleanUp(hub)
              return resolve(msg)
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
  async sendClaim (req, attributes = {}, allowed) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    // init hub connection
    const hub = initHub(this.hubUrls)
    if (!req || !req.channel || !req.key || !req.nonce) {
      throw new Error('Missing required paramaters when calling sendClaim. Got:', req)
    }
    // import encryption key
    const key = await WebCrypto.importKey(Buffer.from(req.key, 'base64'))
    // generate a unique token for the app
    const token = req.token || WebCrypto.genId()
    // generate a symmetric encryption key for this app
    const newKey = await WebCrypto.exportKey(await WebCrypto.genAESKey(true, 'AES-GCM', 128))
    const refreshEncKey = Buffer.from(newKey).toString('base64')
    // encrypt reply message
    const msg = {
      allowed,
      nonce: req.nonce
    }
    if (allowed) {
      msg.did = this.did
      // msg.claim = this.prepareClaim(attributes)
      msg.claim = attributes
      msg.token = token
      msg.refreshEncKey = refreshEncKey
    }
    const encryptedMsg = await WebCrypto.encrypt(key, msg, 'base64')
    // broadcast msg back to the app
    hub.broadcast(req.channel, JSON.stringify({ request: 'claim', msg: encryptedMsg }), async () => {
      // save app settings if we allowed it
      if (allowed) {
        await this.addClaim(token, refreshEncKey, attributes)
      }
      // cleanup
      this.cleanUp(hub)
    })
  }

  // TODO: decide if we continue to use VCs or not
  prepareClaim (attributes) {
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
   * Store a given claim for an app
   *
   * @param {string} token The token identifying the app
   * @param {string} key The encryption key used for the next request
   * @param {Object} attributes The profile attributes shared with the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  addClaim (token, key, attributes) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    if (!token || !key || !attributes) {
      throw new Error('Missing parameter when adding claim')
    }
    return this.store.set(token, {
      key: key,
      attributes: attributes
    })
  }

  /**
   * Retrieve a given claim for an app based on the app token provided
   *
   * @param {string} token The token identifying the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  getClaim (token) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    return this.store.get(token)
  }

  /**
   * Remove a given claim based on the app token provided
   *
   * @param {string} token The token identifying the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  removeClaim (token) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    return this.store.del(token)
  }

  /**
   * Add an app to the local list of allowed apps
   *
   * @param {string} token The token specific to this app
   * @param {Object} appInfo An object describing the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  async addApp (token, appInfo) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    // TODO: validate appInfo schema before storing
    if (!token || !appInfo) {
      throw new Error('Missing parameter when adding app')
    }
    const exists = await this.store.get(token)
    if (!exists) {
      try {
        const apps = await this.store.get('apps') || {}
        apps[token] = appInfo
        return this.store.set('apps', apps)
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  /**
   * Remove one app based on the provided token ID
   *
   * @param {string} appToken The token specific to a given app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  async removeApp (token) {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    if (this.store.get(token)) {
      // also remove claim
      await this.store.del(token)
      // also remove app from list
      try {
        const apps = await this.store.get('apps')
        delete apps[token]
        return this.store.set('apps', apps)
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  /**
   * Return the list all apps currently allowed
   */
  async apps () {
    if (!this.did) {
      throw new Error('Not logged in')
    }
    let apps
    try {
      apps = await this.store.get('apps')
    } catch (e) {
      throw new Error(e)
    }
    return apps || {}
  }

  // Return the current DID
  currentDID () {
    return this.did
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
  Client,
  Wallet
}
