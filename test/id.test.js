/* eslint-env mocha */
/* global chai */

const IdWallet = window.AKASHAidWallet
const IdClient = window.AKASHAidClient

const sleep = timeout => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

describe('AKASHA ID', function () {
  const appInfo = {
    name: 'AKASHA.world',
    description: 'The super cool AKASHA World app!',
    icon: 'https://app.akasha.world/icon.png',
    url: 'https://app.akasha.world'
  }

  const config = {
    hubUrls: ['http://localhost:8888'],
    walletUrl: 'http://localhost:3000'
  }

  const attributes = {
    name: true,
    email: true,
    address: false
  }

  const accountName = 'jane'
  let accountPass = 'password1'

  const Client = new IdClient(appInfo, config)
  let Wallet

  context('Init Wallet', () => {
    it('Should fail to instantiate Wallet without config', () => {
      let err
      try {
        Wallet = new IdWallet()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Wallet = new IdWallet({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Wallet = new IdWallet({ debug: true })
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')
    })

    it('Should successfully init Wallet with proper parameters', async () => {
      let err
      try {
        Wallet = new IdWallet(config)
        await Wallet.init()
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })
  })

  context('Not logged', () => {
    it('Should not list any accounts by default', () => {
      const accounts = Wallet.publicAccounts()
      chai.assert.isEmpty(accounts)
    })

    it('Should fail to create new account without proper prameters', async () => {
      let err
      try {
        await Wallet.signup()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both account name and password are required')

      try {
        await Wallet.signup('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both account name and password are required')

      try {
        await Wallet.signup(undefined, 'foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both account name and password are required')
    })

    it('Should fail to remove an account', async () => {
      let err
      try {
        await Wallet.removeAccount('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to save a private account', async () => {
      let err
      try {
        await Wallet.updateAccount({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to get a private account', async () => {
      let err
      try {
        await Wallet.account({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to export a private account', async () => {
      let err
      try {
        await Wallet.exportAccount()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to update passphrase for a account', async () => {
      let err
      try {
        await Wallet.updatePassphrase(accountPass, 'foobar')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove a account', async () => {
      let err
      try {
        await Wallet.removeAccount()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to add a new profile', async () => {
      let err
      try {
        await Wallet.addProfile({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to update a profile', async () => {
      let err
      try {
        await Wallet.updateProfile('foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove a profile', async () => {
      let err
      try {
        await Wallet.removeProfile('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to list applications if no account is selected', async () => {
      let err
      try {
        await Wallet.apps()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to register an application if no account is selected', async () => {
      let err
      try {
        await Wallet.registerApp({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to add an application if no account is selected', async () => {
      let err
      try {
        await Wallet.addApp('foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove an application if no account is selected', async () => {
      let err
      try {
        await Wallet.removeApp('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to add a claim if no account is selected', async () => {
      let err
      try {
        await Wallet.addClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to get a claim if no account is selected', async () => {
      let err
      try {
        await Wallet.getClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to prepare a claim if no account is selected', async () => {
      let err
      try {
        await Wallet.prepareClaim([])
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove a claim if no account is selected', async () => {
      let err
      try {
        await Wallet.removeClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to send a claim if no account is selected', async () => {
      let err
      try {
        await Wallet.sendClaim({}, true)
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })
  })

  context('Wallet account API', () => {
    it('Should successfully signup and log user in', async () => {
      let err
      let id
      try {
        id = await Wallet.signup(accountName, accountPass)
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)

      const list = await Wallet.publicAccounts()
      chai.assert.equal(id, list[0].id)
      // give the hub and the leader election process time to set up
      await sleep(300)
      chai.assert.isTrue(Wallet.elector.isLeader)
      chai.assert.isDefined(Wallet.hub)
    })

    it('Should list only one account', async () => {
      const list = await Wallet.publicAccounts()
      chai.assert.equal(list.length, 1)
      chai.assert.equal(list[0].name, accountName)
    })

    it('Should log user out of a current account', async () => {
      await Wallet.logout()
      let err
      try {
        Wallet.isLoggedIn()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should log user into an existing account', async () => {
      const accounts = await Wallet.publicAccounts()
      await Wallet.login(accounts[0].id, accountPass)

      chai.assert.isTrue(Wallet.isLoggedIn())
    })

    it('Should fail to update an account when given bad parameters', async () => {
      let err
      try {
        await Wallet.updateAccount()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing attributes')
    })

    it('Should successfully update the public account data', async () => {
      const newName = 'foo bar'
      let accounts = await Wallet.publicAccounts()
      accounts[0].name = newName
      await Wallet.updateAccountsList(accounts[0])
      accounts = await Wallet.publicAccounts()
      chai.assert.equal(newName, accounts[0].name)
    })

    it('Should successfully update the private account data', async () => {
      chai.assert.isUndefined(await Wallet.account())
      const account = {
        name: 'foo bar'
      }
      await Wallet.updateAccount(account)
      chai.assert.isDefined(await Wallet.account())
    })

    it('Should successfully export the current account', async () => {
      const dump = await Wallet.exportAccount()
      const pub = await Wallet.publicAccounts()

      chai.assert.equal(dump.id, pub[0].id)
      chai.assert.equal(dump.publicAccount.name, pub[0].name)
    })

    it('Should successfully import a account using the same name', async () => {
      const dump = await Wallet.exportAccount()
      let account = await Wallet.account()
      const oldName = account.name
      account.name = 'foo' // was 'foo bar'
      await Wallet.updateAccount(account)

      await Wallet.importAccount(dump, accountPass)
      account = await Wallet.account()
      chai.assert.equal(account.name, oldName)
    })

    it('Should successfully import an account using a different name', async () => {
      const newName = 'joanne'

      const dump = await Wallet.exportAccount()

      await Wallet.importAccount(dump, accountPass, newName)

      const pub = await Wallet.publicAccounts()
      chai.assert.equal(newName, pub[0].name)
    })

    it('Should fail to update the passphrase that protects the encryption key when given bad parameters', async () => {
      let err
      try {
        await Wallet.updatePassphrase()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both old and new passwords must be provided')

      try {
        await Wallet.updatePassphrase('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both old and new passwords must be provided')

      try {
        await Wallet.updatePassphrase(undefined, 'foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both old and new passwords must be provided')
    })

    it('Should update the passphrase that protects the encryption key', async () => {
      await Wallet.updatePassphrase(accountPass, 'foobar')
      await Wallet.logout()

      const accounts = await Wallet.publicAccounts()
      await Wallet.login(accounts[0].id, 'foobar')
      chai.assert.isTrue(Wallet.isLoggedIn())
      // update it for the future
      accountPass = 'foobar'
    })

    it('Should remove an existing account and log the user out', async () => {
      await Wallet.removeAccount()
      const accounts = await Wallet.publicAccounts()

      chai.assert.isEmpty(accounts)
      let err
      try {
        Wallet.isLoggedIn()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })
  })

  context('Wallet profile API', () => {
    // first we create a valid profile
    before(async () => {
      await Wallet.signup(accountName, accountPass)
    })

    it('Should fail to add a profile when given bad parameters', async () => {
      let err
      try {
        await Wallet.addProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing attributes')
    })

    it('Should successfully add a new profile', async () => {
      chai.assert.isEmpty(await Wallet.profiles())
      const profile = {
        profileName: 'social'
      }
      await Wallet.addProfile(profile)
      chai.assert.isNotEmpty(await Wallet.profiles())
    })

    it('Should successfully list all the profiles for the account', async () => {
      const list = await Wallet.profiles()
      chai.assert.isNotEmpty(list)
      chai.assert.equal(list[0].profileName, 'social')
    })

    it('Should fail to update a profile when given bad parameters', async () => {
      let err
      try {
        await Wallet.updateProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing attributes')

      try {
        await Wallet.updateProfile('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing attributes')

      try {
        await Wallet.updateProfile(undefined, {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing attributes')
    })

    it('Should successfully update a profile', async () => {
      const newName = 'work'
      let profiles = await Wallet.profiles()

      profiles[0].profileName = newName
      await Wallet.updateProfile(profiles[0])
      profiles = await Wallet.profiles()
      chai.assert.equal(profiles[0].profileName, newName)
    })

    it('Should fail to remove a profile when given bad parameters', async () => {
      let err
      try {
        await Wallet.removeProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'No profile id provided')
    })

    it('Should successfully remove a profile', async () => {
      const profiles = await Wallet.profiles()
      await Wallet.removeProfile(profiles[0].id)
      chai.assert.isEmpty(await Wallet.profiles())
    })
  })

  context('Wallet app API', async () => {
    // first we create a valid profile
    before(async () => {
      const profile = {
        profileName: 'social'
      }
      await Wallet.addProfile(profile)
    })

    it('Should fail to parse a bad registration link', async () => {
      let err
      try {
        Wallet.parseRegisterLink('foo')
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'SyntaxError')
    })

    it('Should successfully parse a registration link', async () => {
      const link = await Client.registrationLink()
      const reqStr = link.substring(config.walletUrl.length)

      const parsed = Wallet.parseRegisterLink(reqStr)

      chai.assert.isTrue(parsed.channel.length > 0)
      chai.assert.isTrue(parsed.key.length > 0)
      chai.assert.isTrue(parsed.nonce > 0)
    })

    it('Should successfully return an empty list of apps for a given profile', async () => {
      const profiles = await Wallet.profiles()
      const apps = await Wallet.apps(profiles[0].id)
      chai.assert.isEmpty(apps)
    })

    it('Should fail to add a new app without proper parameters', async () => {
      let err
      try {
        await Wallet.addApp()
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding app')

      try {
        await Wallet.addApp('foo')
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding app')

      try {
        await Wallet.addApp(undefined, {})
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding app')
    })

    it('Should successfully add a new app', async () => {
      let err
      const req = {
        token: 'foo',
        appInfo: appInfo
      }

      const profiles = await Wallet.profiles()
      const id = profiles[0].id
      try {
        await Wallet.addApp(req, id, attributes)
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })

    it('Should successfully list the app', async () => {
      const profiles = await Wallet.profiles()
      const id = profiles[0].id
      const apps = await Wallet.apps(id)

      chai.assert.equal(apps[0].id, 'foo')
      chai.assert.equal(apps[0].profile, id)
      chai.assert.deepEqual(apps[0].appInfo, appInfo)
      chai.assert.deepEqual(apps[0].attributes, attributes)
    })

    it('Should successfully remove the app', async () => {
      await Wallet.removeApp('foo')
      const apps = await Wallet.apps()
      chai.assert.isEmpty(apps)
    })
  })

  context('Wallet claim API', async () => {
    // Register the app before creating claims
    before(async () => {
      const req = {
        token: 'foo',
        appInfo: appInfo
      }

      const profiles = await Wallet.profiles()
      const id = profiles[0].id
      await Wallet.addApp(req, id, attributes)
    })

    it('Should fail to add a new claim without proper parameters', async () => {
      let err
      try {
        await Wallet.addClaim()
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding claim')

      try {
        await Wallet.addClaim(undefined, 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding claim')

      try {
        await Wallet.addClaim('foo', undefined, {})
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding claim')

      try {
        await Wallet.addClaim('foo', 'foo')
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing parameter when adding claim')
    })

    it('Should successfully add a claim for the current user', async () => {
      let err
      try {
        await Wallet.addClaim('foo', 'bar')
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })

    it('Should successfully get a claim using the provided token', async () => {
      const claim = await Wallet.getClaim('foo')

      chai.assert.equal(claim.key, 'bar')
    })

    it('Should fail to prepare a claim without proper parameters', async () => {
      let err
      try {
        await Wallet.prepareClaim()
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing attributes when preparing claim')

      try {
        await Wallet.prepareClaim([])
      } catch (error) {
        err = error
      }
      chai.assert.include(err.message, 'Missing attributes when preparing claim')
    })

    it('Should successfully prepare a claim using the provided attributes', async () => {
      const profiles = await Wallet.profiles()
      profiles[0].name = 'foo bar'
      profiles[0].email = 'foo@bar.org'
      profiles[0].address = '1st Avenue'

      await Wallet.updateProfile(profiles[0])
      const apps = await Wallet.apps(profiles[0].id)
      const app = apps[0]

      let prepared
      try {
        prepared = await Wallet.prepareClaim(app.id)
      } catch (e) {
        console.log('Error', e)
      }

      // check if we have all the attributes and values
      Object.keys(app.attributes).forEach(attr => {
        if (app.attributes[attr]) {
          chai.assert.equal(profiles[0][attr], prepared.credentialSubject[attr])
        }
      })
      // also check if DID is there
      chai.assert.include(Object.keys(prepared.credentialSubject), 'id')
    })

    it('Should successfully remove a claim using the provided token', async () => {
      await Wallet.removeClaim('foo')
      const claim = await Wallet.getClaim('foo')

      chai.assert.isUndefined(claim)
    })
  })

  context('Client <-> Wallet e2e', () => {
    // first we create a valid profile
    before(async () => {
      await Wallet.removeApp('foo')
    })

    let clientClaim

    it('Should fail to register a new app from a request we denied', async () => {
      const link = await Client.registrationLink()

      const request = Client.requestProfile()
      // give the client some time to setup listener
      await sleep(50)

      const msg = await Wallet.registerApp(link.substring(config.walletUrl.length))
      chai.assert.isUndefined(msg.attributes)

      await Wallet.sendClaim(msg, false)

      const profiles = await Wallet.profiles()
      const id = profiles[0].id

      const apps = await Wallet.apps(id)
      chai.assert.isEmpty(apps)

      return new Promise(resolve => {
        request.then(response => {
          chai.assert.isFalse(response.allowed)
          chai.assert.isUndefined(response.claim)
          return resolve()
        })
      })
    })

    it('Should successfully register a new app from a request we allowed', async () => {
      const attr = ['name', 'email']

      const link = await Client.registrationLink()

      const request = Client.requestProfile(attr)
      // give the client some time to setup listener
      await sleep(50)

      const msg = await Wallet.registerApp(link.substring(config.walletUrl.length))
      chai.assert.exists(msg.token)
      chai.assert.exists(msg.key)
      chai.assert.exists(msg.channel)
      chai.assert.equal(msg.nonce, Client.nonce)
      chai.assert.deepEqual(msg.appInfo, appInfo)
      chai.assert.deepEqual(msg.attributes, attr)

      // save app
      const profiles = await Wallet.profiles()
      const id = profiles[0].id
      await Wallet.addApp(msg, id, attributes)
      await Wallet.sendClaim(msg, true)

      const apps = await Wallet.apps(id)
      const app = apps[0]
      chai.assert.deepEqual(app.appInfo, appInfo)

      return new Promise(resolve => {
        request.then(async response => {
          chai.assert.isTrue(response.allowed)
          chai.assert.equal(response.did, Wallet.did())
          chai.assert.equal(response.token, msg.token)
          chai.assert.isDefined(response.claim)
          // save this client claim for refresh test
          clientClaim = response
          await Wallet.logout()
          return resolve()
        })
      })
    })

    it('Should successfully refresh a claim', async () => {
      const accounts = await Wallet.publicAccounts()
      await Wallet.login(accounts[0].id, accountPass)
      await sleep(200)

      const request = Client.refreshProfile(clientClaim)

      const p = new Promise(resolve => {
        request.then(async response => {
          const claim = await Wallet.getClaim(clientClaim.token)
          chai.assert.isTrue(response.allowed)
          chai.assert.equal(response.did, Wallet.did())
          chai.assert.equal(response.token, clientClaim.token)
          chai.assert.notEqual(response.refreshEncKey, clientClaim.refreshEncKey)
          chai.assert.equal(response.refreshEncKey, claim.key)
          resolve()
        })
      })
      // give the wallet some time to process the request
      await sleep(200)

      return p
    })
  })
})
