const signalhub = require('signalhub')
const generateId = require('./utils').generateId
const crypto = require('masq-common').crypto

const HUB_URLS = [ 'localhost:8080' ]
const WALLET_URL = 'http://localhost:3000'

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
    async initHub (channel, callback) {
      const hub = signalhub(channel, this.config.hubUrls)  
      hub.subscribe(channel).on('data', callback)
      return hub
    }
    // Generate a special link to request access to the user's DID
    async genLoginLink () {
      // generate a one time channel ID
      this.loginChannel = generateId()
      // generate a one time symmetric encryption key and reveal it to AKASHA.id
      this.loginKey = await crypto.genAESKey(true, 'AES-GCM', 128)
      const extractedKey = await crypto.exportKey(this.loginKey)
      const b64Key = Buffer.from(extractedKey).toString('base64')
      // use the wallet app URL for the link
      const loginUrl = new URL(this.config.walletBaseUrl)
      const hashParams = JSON.stringify([this.appName, this.loginChannel, b64Key])
      console.log(hashParams)
      loginUrl.hash = '/link/' + Buffer.from(hashParams).toString('base64')
  
      this.loginLink = loginUrl.href
      return this.loginLink
    }
}

class DIDwallet {
  constructor (hubUrls) {
    // init config
    this.config = {
      hubUrls: hubUrls ? hubUrls : HUB_URLS
    }
  }

  parseLoginLink (hash) {
    const decoded = Buffer.from(hash, 'base64')

    try {
      return JSON.parse(decoded) // eslint-disable-line
    } catch (e) {
      console.error(e)
    }
  }
}

module.exports = {
  DIDclient,
  DIDwallet,
  generateId
}
