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
   * Initialize the Wallet by loading all the account IDs
   */
  async init () {
    try {
      this.accounts = await SecureStore._idb.get('accounts')
      if (!this.accounts) {
        this.accounts = {}
      }
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * Create an AKASHA DID based on a given identifier
   *
   * @returns {string} - The DID
   */
  did () {
    this.isLoggedIn()
    return `did:akasha:${this.id}`
  }

  /* ------------- Accounts API ------------- */
  /**
    * Sign up a user
    *
    * @param {string} name - The account name
    * @param {string} passphrase - The user's passphrase
    * @returns {string} id - The id specific to the new account
    */
  async signup (name, passphrase) {
    if (!name || !passphrase) {
      throw new Error('Both account name and password are required')
    }
    // TODO: should use key derivation for future proof of ownership when
    // generating a new ID
    this.id = WebCrypto.genId()
    // add this user to the local list of available accounts
    await this.updateAccountsList({
      id: this.id,
      name
    })
    // also log user in
    await this.login(this.id, passphrase)
    return this.id
  }

  /**
    * Log a user into a specific account
    *
    * @param {string} userId - The user identifier
    * @param {string} passphrase - The user's passphrase
    */
  async login (userId, passphrase) {
    try {
      this.id = userId
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
   * Log an user out of a specific account
   */
  async logout () {
    if (this.hub) await this.cleanUp(this.hub)
    if (this.elector) await this.elector.die()
    this.elector = undefined
    this.hub = undefined
    this.id = undefined
    this.store.close()
    this.store = undefined
  }

  /**
   * Return the account data for the current user
   *
   * @returns {Promise<Object>} - A promise that contains the account object
   */
  async account () {
    this.isLoggedIn()
    return this.store.get('account')
  }

  /**
    * Update the passphrase that protects the encryption key for an account
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
   * Return the public list of accounts
   */
  async publicAccounts () {
    const publics = []
    const accounts = await SecureStore._idb.get('accounts') || {}

    const ids = Object.keys(accounts)
    if (ids.length === 0) {
      return publics
    }
    ids.forEach(id => {
      publics.push({
        id,
        name: accounts[id].name,
        picture: accounts[id].picture
      })
    })
    return publics
  }

  /**
    * Update the public list of accounts
    *
    * @param {Object} account - The user's (public) account info that is used when
    * building the list
    * @returns {Promise} - The promise that resolves upon successful completion of the
    * data store operation
    */
  async updateAccountsList (account) {
    if (!account.id || !account.name) {
      throw new Error('Missing parameters from public account data')
    }
    try {
      this.accounts = await SecureStore._idb.get('accounts')
      if (!this.accounts) {
        this.accounts = {}
      }
      this.accounts[account.id] = {
        name: account.name,
        picture: account.picture || undefined
      }
      // Use the raw idb object to set the accounts in the default (public) store
      await SecureStore._idb.set('accounts', this.accounts)
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * Update private account information
   *
   * @param {Object} data - The account data to be stored
   * @returns {Promise} - A promise that resolves once the operation has completed
   */
  async updateAccount (data) {
    this.isLoggedIn()
    if (!data) {
      throw new Error('Missing attributes')
    }
    try {
      return this.store.set('account', data)
    } catch (e) {
      throw new Error(e.message)
    }
  }

  /**
   * Remove the current user account
   *
   * @param {string} The user's account ID
   */
  async removeAccount () {
    this.isLoggedIn()
    try {
      delete this.accounts[this.id]
      await SecureStore._idb.set('accounts', this.accounts)
    } catch (e) {
      throw new Error(e)
    }
    await this.store.clear()
    // TODO: remove the empty db and store (needs upstream implementation in idbkeyval)
    await this.logout()
  }

  /**
   * Export current account and all the apps and claims that go with it
   * as a single JSON object.
   *
   * @returns {Promise<Object>} - A promise containing the exported data
   */
  async exportAccount () {
    this.isLoggedIn()
    return {
      id: this.id,
      publicAccount: this.accounts[this.id],
      store: await this.store.export()
    }
  }

  /**
   * Import a account and all the apps and claims that go with it
   * as a single JSON object.
   * ATTENTION: it will overwrite any existing account with the same
   * id!
   *
   * @param {Object} data - A JSON object with the encrypted dump
   * @param {string} passphrase - The passphrase that encrypts the data
   * @param {string} name - Account name (if provided can be used to
   * import the data under a new account name)
   *
   * @returns {Promise} - The promise that resolves upon successful
   * completion of the import operation
   */
  async importAccount (data, passphrase, name) {
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

    // also update list of accounts
    const publicAccount = data.publicAccount || {}
    // specify/update name if so desired
    if (name) {
      publicAccount.name = name
    }
    // make sure we have the id in the account info
    publicAccount.id = data.id

    return this.updateAccountsList(publicAccount)
  }

  /* ------------- Personas API ------------- */

  /**
   * Get the data for a given persona
   *
   * @param {string} id - The persona id to lookup
   * @returns {Object} - An object containing all the personas and their data
   */
  async persona (id) {
    this.isLoggedIn()
    const personas = await this.store.get('personas')
    return personas[id]
  }

  /**
   * Get the list of personas for the current account
   *
   * @returns {Object} - An object containing all the personas and their data
   */
  async personas () {
    this.isLoggedIn()
    const personas = await this.store.get('personas') || {}

    const ids = Object.keys(personas)
    if (ids.length === 0) {
      return []
    }
    const list = []
    ids.forEach(id => {
      list.push(personas[id])
    })
    return list
  }

  /**
   * Add a new persona
   *
   * @param {Object} persona - The persona data to be stored
   * @returns {Promise} - A promise that resolves once the operation has completed
   */
  async addPersona (persona) {
    this.isLoggedIn()
    if (!persona || !persona.personaName) {
      throw new Error('Missing attributes')
    }
    // first we generate a new ID for the persona
    persona.id = WebCrypto.genId()
    return this.updatePersona(persona)
  }

  /**
   * Update persona information
   *
   * @param {Object} persona - The persona data to be stored
   * @returns {Promise} - A promise that resolves once the operation has completed
   */
  async updatePersona (data) {
    this.isLoggedIn()
    if (!data || !data.id || !data.personaName) {
      throw new Error('Missing attributes')
    }
    try {
      const personas = await this.store.get('personas') || {}
      personas[data.id] = data
      return this.store.set('personas', personas)
    } catch (e) {
      throw new Error(e.message)
    }
  }

  /**
   * Remove a specific persona
   *
   * @param {string} id - The persona id to remove
   * @returns {Promise} - A promise that resolves once the operation has completed
   */
  async removePersona (id) {
    this.isLoggedIn()
    if (!id) {
      throw new Error('No persona id provided')
    }
    try {
      // remove apps for this persona
      const apps = await this.apps(id)
      apps.forEach(async app => {
        await this.removeApp(app.id)
      })
      // remove persona
      const personas = await this.store.get('personas')
      delete personas[id]
      return this.store.set('personas', personas)
    } catch (e) {
      throw new Error(e)
    }
  }

  /* ------------- Requests API ------------- */

  /**
   * Handler for the refresh operation
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
      try {
        await this.sendClaim(claim, true)
        debug(`Sent updated claim!`)
      } catch (e) {
        console.log(e)
      }
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
   * @param {Object} req - The request coming from the client app
   * @param {string} personaId - The persona id used for this app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  async addApp (req, personaId, attributes) {
    this.isLoggedIn()
    // TODO: validate appInfo schema before storing
    if (!req || !req.token || !req.appInfo || !personaId || !attributes) {
      throw new Error('Missing parameter when adding app')
    }
    const exists = await this.store.get(req.token)
    if (!exists) {
      try {
        const apps = await this.store.get('apps') || {}
        apps[req.token] = {
          persona: personaId,
          appInfo: req.appInfo,
          attributes
        }
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
   * Return the list all apps currently allowed for a given persona
   */
  async apps (personaId) {
    this.isLoggedIn()
    let apps
    try {
      apps = await this.store.get('apps') || {}
    } catch (e) {
      throw new Error(e)
    }
    const list = []
    const ids = Object.keys(apps)

    const matching = ids.filter(id => { return apps[id].persona === personaId })
    matching.forEach(id => {
      apps[id].id = id
      list.push(apps[id])
    })
    return list
  }

  /**
   * Return the all data for a given app ID
   */
  async appInfo (token) {
    this.isLoggedIn()
    let apps
    try {
      apps = await this.store.get('apps')
    } catch (e) {
      throw new Error(e)
    }
    return apps[token] || {}
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
    * Send a claim with persona attributes
    *
    * @param {Object} req - The request coming from the client app
    * @param {Object} attributes - An object containing persona attributes
    * @param {string} [mode] - The mode of the key to import (default 'AES-GCM')
    * @returns {Promise<Object>} - The data used for the claim once it has been sent,
    * to be stored by the wallet app
    */
  async sendClaim (req, allowed) {
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
      msg.did = this.did()
      msg.claim = await this.prepareClaim(token)
      msg.token = token
      msg.refreshEncKey = refreshEncKey
      // store claim
      await this.addClaim(token, refreshEncKey)
    }
    const encryptedMsg = await WebCrypto.encrypt(key, msg, 'base64')
    // broadcast msg back to the app
    hub.broadcast(req.channel, JSON.stringify({ request: 'claim', msg: encryptedMsg }), async () => {
      // cleanup
      this.cleanUp(hub)
    })
  }

  // TODO: decide if we continue to use VCs or not
  /**
   * Prepare a claim before being sent
   *
   * @param {string} token - The app token
   * @returns {Object} - The claim object
   * data store operation
   */
  async prepareClaim (token) {
    this.isLoggedIn()
    try {
      // get app details for this token
      const app = await this.appInfo(token)

      if (!app.attributes || app.attributes.length === 0) {
        throw new Error('Missing attributes when preparing claim')
      }
      const credential = {}
      const persona = await this.persona(app.persona)

      Object.keys(app.attributes).forEach(attr => {
        if (app.attributes[attr]) {
          credential[attr] = persona[attr]
        }
      })
      // also add the did
      const did = this.did()
      credential.id = did
      // return the formatted VC
      return {
        '@context': ['https://www.w3.org/2018/credentials/v1', 'https://schema.org/'],
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: did,
        issuanceDate: new Date().toISOString(),
        credentialSubject: credential,
        proof: {}
      }
    } catch (e) {
      throw new Error(e.message)
    }
  }

  /**
   * Store a given claim for an app
   *
   * @param {string} token The token identifying the app
   * @param {string} key The encryption key used for the next request
   * @param {Object} attributes The persona attributes shared with the app
   * @returns {Promise} - The promise that resolves upon successful completion of the
   * data store operation
   */
  addClaim (token, key) {
    this.isLoggedIn()
    if (!token || !key) {
      throw new Error('Missing parameter when adding claim')
    }
    return this.store.set(token, {
      key: key
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
    if (!this.id) {
      throw new Error('Not logged in')
    }
    return true
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
