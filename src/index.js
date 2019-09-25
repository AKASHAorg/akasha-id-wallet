const Signalhub = require('signalhub') // might switch to SocketCluster later
const BroadcastChannel = require('broadcast-channel').default
const LeaderElection = require('broadcast-channel/leader-election')
const SecureStore = require('secure-webstore')
const WebCrypto = require('easy-web-crypto')

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

  /* ------------- User API ------------- */
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
    this.store.close()
    this.store = undefined
  }

  /**
   * Return the full profile for the current user
   *
   * @returns {Promise<Object>} - A promise that contains the profile object
   */
  async profile () {
    this.isLoggedIn()
    return this.store.get('profile')
  }

  /**
   * Save full profile for the current user
   *
   * @param {string} oldPass - The current password
   * @returns {Promise} - A promise that resolves once the operation has completed
   */
  async updateProfile (data) {
    this.isLoggedIn()
    if (!data) {
      throw new Error('No profile data present')
    }
    return this.store.set('profile', data)
  }

  /**
    * Update the passphrase that protects the encryption key for a profile
    *
    * @param {string} oldPass - The current password
    * @param {string} newPass - The new password
    * @returns {Promise} - A promise that resolves once the operation has completed
    */
  async updatePassphrase (oldPass, newPass) {
    this.isLoggedIn()
    if (!oldPass || !newPass) {
      throw new Error('Both old and new passwords must be provided')
    }
    return this.store.updatePassphrase(oldPass, newPass)
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
      // Use the raw idb object to set the profiles in the default (public) store
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
    this.isLoggedIn()
    if (!id) {
      throw new Error('No profile id provided')
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
   * Export current profile and all the apps and claims that go with it
   * as a single JSON object.
   *
   * @returns {Promise<Object>} - A promise containing the exported data
   */
  async exportProfile () {
    this.isLoggedIn()
    return {
      id: this.id,
      publicProfile: this.profiles[this.id],
      store: await this.store.export()
    }
  }

  /**
   * Import a profile and all the apps and claims that go with it
   * as a single JSON object.
   * ATTENTION: it will overwrite any existing profile with the same
   * id!
   *
   * @param {Object} data - A JSON object with the encrypted dump
   * @param {string} passphrase - The passphrase that encrypts the data
   * @param {string} name - Profile name (if provided can be used to
   * import the data under a new profile name)
   *
   * @returns {Promise} - The promise that resolves upon successful
   * completion of the import operation
   */
  async importProfile (data, passphrase, name) {
    if (!passphrase) {
      throw new Error('Password is required')
    }
    if (!data.id || !data.store) {
      throw new Error('Missing attributes in the data to be imported')
    }
    // set up the store
    const store = new SecureStore.Store(data.id, passphrase)
    await store.init()
    await store.import(data.store)
    store.close()

    // also update list of profiles
    const publicProfile = data.publicProfile || {}
    // specify/update name if so desired
    if (name) {
      publicProfile.name = name
    }

    return this.updateProfileList(data.id, publicProfile)
  }

  // Return the current DID
  currentDID () {
    return this.did
  }

  /* ------------- Requests API ------------- */

  /**
   * Handler for the profile refresh operations
   *
   * @param {Object} data - The request data coming from the app
   */
  async handleRefresh (data) {
    try {
      const localData = await this.store.get(data.token)
      if (!localData) {
        // TODO: handle revoked apps
        debug(`Cannot find a matching app for the token ${data.token}`)
        return
      }
      const key = await WebCrypto.importKey(Buffer.from(localData.key, 'base64'))
      const req = await WebCrypto.decrypt(key, data.msg, 'base64')
      const claim = {
        channel: req.channel,
        token: data.token,
        key: localData.key,
        nonce: req.nonce
      }
      await this.sendClaim(claim, localData.attributes, true)
      debug(`Sent updated claim!`)
    } catch (e) {
      debug(e)
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
    this.hub = initHub(this.hubUrls)
    try {
      this.hub.subscribe(this.id).on('data', async (data) => {
        data = JSON.parse(data)
        switch (data.request) {
          case 'refresh':
            debug('Got refresh request:', data)
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

  /* ------------- App API ------------- */

  /**
   * Add an app to the local list of allowed apps
   *
   * @param {string} token The token specific to this app
   * @param {Object} appInfo An object describing the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  async addApp (token, appInfo) {
    this.isLoggedIn()
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
    this.isLoggedIn()
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
    this.isLoggedIn()
    let apps
    try {
      apps = await this.store.get('apps')
    } catch (e) {
      throw new Error(e)
    }
    return apps || {}
  }

  /**
    * Set up an initial exchange to receive app information
    *
    * @param {Object} data - A base64-encoded string containing an encryption key, a nonce
    * and a channelID to bootstrap the registration process
    * @returns {Promise<Object>} - The application token and data to be stored by the wallet app
    */
  async registerApp (data) {
    this.isLoggedIn()
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
    this.isLoggedIn()
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
      msg.claim = await this.prepareClaim(attributes)
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
  async prepareClaim (attributes) {
    this.isLoggedIn()
    if (!attributes || attributes.length === 0) {
      throw new Error('Missing attributes when preparing claim')
    }
    const credential = {}

    const profile = await this.profile()
    attributes.forEach(attr => {
      if (profile[attr]) credential[attr] = profile[attr]
    })
    // also add the did
    credential.id = this.did
    // return the formatted VC
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://schema.org/'],
      type: ['VerifiableCredential', 'IdentityCredential'],
      issuer: this.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: credential,
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
    this.isLoggedIn()
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
    this.isLoggedIn()
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
    this.isLoggedIn()
    return this.store.del(token)
  }

  isLoggedIn () {
    if (!this.did) {
      throw new Error('Not logged in')
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

module.exports = Wallet
