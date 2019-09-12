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
  const profileName = 'jane'
  let profilePass = 'password1'

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

  context('Not logged into wallet', () => {
    it('Should not list any profiles by default', () => {
      const profiles = Wallet.publicProfiles()
      chai.assert.isEmpty(profiles)
    })

    it('Should fail to create new profile without proper prameters', async () => {
      let err
      try {
        await Wallet.signup()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both profile name and password are required')

      try {
        await Wallet.signup('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both profile name and password are required')

      try {
        await Wallet.signup(undefined, 'foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Both profile name and password are required')
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

    it('Should fail to save a private profile', async () => {
      let err
      try {
        await Wallet.updateProfile({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to get a private profile', async () => {
      let err
      try {
        await Wallet.profile({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to export a private profile', async () => {
      let err
      try {
        await Wallet.exportProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to update passphrase for a profile', async () => {
      let err
      try {
        await await Wallet.updatePassphrase(profilePass, 'foobar')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to list applications if no profile is selected', async () => {
      let err
      try {
        await Wallet.apps()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to register an application if no profile is selected', async () => {
      let err
      try {
        await Wallet.registerApp({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to add an application if no profile is selected', async () => {
      let err
      try {
        await Wallet.addApp('foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove an application if no profile is selected', async () => {
      let err
      try {
        await Wallet.removeApp('foo')
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to add a claim if no profile is selected', async () => {
      let err
      try {
        await Wallet.addClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to get a claim if no profile is selected', async () => {
      let err
      try {
        await Wallet.getClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to prepare a claim if no profile is selected', async () => {
      let err
      try {
        await Wallet.prepareClaim([])
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to remove a claim if no profile is selected', async () => {
      let err
      try {
        await Wallet.removeClaim('foo', 'foo', {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })

    it('Should fail to send a claim if no profile is selected', async () => {
      let err
      try {
        await Wallet.sendClaim({}, {}, true)
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Not logged in')
    })
  })

  context('Wallet profile API', () => {
    it('Should successfully create new profile with proper parameters and log user in', async () => {
      let err
      let id
      try {
        id = await Wallet.signup(profileName, profilePass)
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)

      const profiles = Wallet.publicProfiles()
      chai.assert.equal(id, profiles[0].id)
      // give the hub and the leader election process time to set up
      await sleep(300)
      chai.assert.isTrue(Wallet.elector.isLeader)
      chai.assert.isDefined(Wallet.hub)
    })

    it('Should have created an AKASHA DID', () => {
      chai.assert.equal(Wallet.currentDID().length, 43)
      chai.assert.equal(Wallet.currentDID().substring(0, 11), 'did:akasha:')
    })

    it('Should list only one profile', () => {
      const profiles = Wallet.publicProfiles()
      chai.assert.equal(profiles.length, 1)
      chai.assert.equal(profiles[0].name, profileName)
    })

    it('Should log user out of a current profile', async () => {
      await Wallet.logout()
      chai.assert.isUndefined(Wallet.currentDID())
    })

    it('Should log user into an existing profile', async () => {
      const profiles = Wallet.publicProfiles()
      await Wallet.login(profiles[0].id, profilePass)

      chai.assert.exists(Wallet.currentDID(), profiles[0].id)
    })

    it('Should fail to save a profile when given bad parameters', async () => {
      let err
      try {
        await Wallet.updateProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'No profile data present')
    })

    it('Should successfully set the profile', async () => {
      chai.assert.isUndefined(await Wallet.profile())
      const profile = {
        name: 'foo bar',
        familyName: 'bar',
        givenName: 'foo',
        email: 'foo@bar.org'
      }
      await Wallet.updateProfile(profile)
      chai.assert.isDefined(await Wallet.profile())
    })

    it('Should successfully export the current profile', async () => {
      const dump = await Wallet.exportProfile()
      const publicProfile = Wallet.publicProfiles()[0]

      chai.assert.equal(dump.id, publicProfile.id)
      chai.assert.equal(dump.publicProfile.name, publicProfile.name)
    })

    it('Should successfully import a profile using the same', async () => {
      const dump = await Wallet.exportProfile()

      let profile = await Wallet.profile()
      const oldName = profile.name
      profile.name = 'foo' // was 'foo bar'
      await Wallet.updateProfile(profile)

      await Wallet.importProfile(dump, profilePass)
      profile = await Wallet.profile()
      chai.assert.equal(profile.name, oldName)
    })

    it('Should successfully import a profile using a different name', async () => {
      const newName = 'joanne'

      const dump = await Wallet.exportProfile()

      await Wallet.importProfile(dump, profilePass, newName)

      const publicProfile = Wallet.publicProfiles()[0]
      chai.assert.equal(newName, publicProfile.name)
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
      await Wallet.updatePassphrase(profilePass, 'foobar')
      await Wallet.logout()

      const profiles = Wallet.publicProfiles()
      await Wallet.login(profiles[0].id, 'foobar')
      chai.assert.exists(Wallet.currentDID(), profiles[0].id)
      // update it for the future
      profilePass = 'foobar'
    })

    it('Should fail to remove a profile if no ID was provided', async () => {
      let err
      try {
        await Wallet.removeProfile()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'No profile id provided')
    })

    it('Should remove an existing profile and log the user out', async () => {
      await Wallet.removeProfile(Wallet.id)
      const profiles = Wallet.publicProfiles()

      chai.assert.isEmpty(profiles)
      chai.assert.isUndefined(Wallet.currentDID())
    })
  })

  context('Wallet app API', async () => {
    // first we create a valid profile
    before(async () => {
      await Wallet.signup(profileName, profilePass)
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

    it('Should successfully return an empty list of apps', async () => {
      const apps = await Wallet.apps()

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
      try {
        await Wallet.addApp('foo', appInfo)
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })

    it('Should successfully list the app', async () => {
      const apps = await Wallet.apps()

      chai.assert.isNotEmpty(apps)
      chai.assert.deepEqual(apps['foo'], appInfo)
    })

    it('Should successfully remove the app', async () => {
      await Wallet.removeApp('foo')
      const apps = await Wallet.apps()

      chai.assert.isEmpty(apps)
    })
  })

  context('Wallet claim API', async () => {
    // first we create a valid profile
    before(async () => {
      await Wallet.signup(profileName, profilePass)
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
        await Wallet.addClaim('foo', 'bar', ['givenName', 'email'])
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })

    it('Should successfully get a claim using the provided token', async () => {
      const claim = await Wallet.getClaim('foo')

      chai.assert.deepEqual(claim.attributes, ['givenName', 'email'])
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
      const profile = {
        name: 'foo bar',
        familyName: 'bar',
        givenName: 'foo',
        email: 'foo@bar.org'
      }
      await Wallet.updateProfile(profile)

      const claim = await Wallet.getClaim('foo')

      const prepared = await Wallet.prepareClaim(claim.attributes)
      const attributes = Object.keys(prepared.credentialSubject)
      // check if we have all the attributes and values
      claim.attributes.forEach(attr => {
        chai.assert.equal(profile[attr], prepared.credentialSubject[attr])
      })
      // also check if DID is there
      chai.assert.include(attributes, 'id')
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
      await Wallet.logout()
      await Wallet.signup(profileName, profilePass)
      const profile = {
        name: 'foo bar',
        familyName: 'bar',
        givenName: 'foo',
        email: 'foo@bar.org'
      }
      await Wallet.updateProfile(profile)
      await sleep(300)
    })

    let clientClaim

    it('Should fail to register a new app from a request we denied', async () => {
      const link = await Client.registrationLink()

      const request = Client.requestProfile()
      // give the client some time to setup listener
      await sleep(100)

      const msg = await Wallet.registerApp(link.substring(config.walletUrl.length))
      chai.assert.isUndefined(msg.attributes)

      await Wallet.sendClaim(msg, [], false)

      const apps = await Wallet.apps()
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
      const attributes = ['name', 'email']

      const link = await Client.registrationLink()

      const request = Client.requestProfile(attributes)
      // give the client some time to setup listener
      await sleep(100)

      const msg = await Wallet.registerApp(link.substring(config.walletUrl.length))
      chai.assert.exists(msg.token)
      chai.assert.exists(msg.key)
      chai.assert.exists(msg.channel)
      chai.assert.equal(msg.nonce, Client.nonce)
      chai.assert.deepEqual(msg.appInfo, appInfo)
      chai.assert.deepEqual(msg.attributes, attributes)

      // save app
      await Wallet.addApp(msg.token, msg.appInfo)
      await Wallet.sendClaim(msg, attributes, true)

      const apps = await Wallet.apps()
      chai.assert.deepEqual(apps[msg.token], appInfo)

      const profile = await Wallet.profile()

      return new Promise(resolve => {
        request.then(response => {
          chai.assert.isTrue(response.allowed)
          chai.assert.equal(response.did, Wallet.currentDID())
          chai.assert.equal(response.token, msg.token)
          chai.assert.isDefined(response.claim)
          // check if we have all the attributes and values
          attributes.forEach(attr => {
            chai.assert.equal(profile[attr], response.claim.credentialSubject[attr])
          })
          // save this client claim for refresh test
          clientClaim = response
          return resolve()
        })
      })
    })

    it('Should successfully refresh a claim', async () => {
      const request = Client.refreshProfile(clientClaim)

      // give the wallet some time to process the request
      await sleep(200)

      const claim = await Wallet.getClaim(clientClaim.token)

      return new Promise(resolve => {
        request.then(async response => {
          chai.assert.isTrue(response.allowed)
          chai.assert.equal(response.did, Wallet.currentDID())
          chai.assert.equal(response.token, clientClaim.token)
          chai.assert.notEqual(response.refreshEncKey, clientClaim.refreshEncKey)
          chai.assert.equal(response.refreshEncKey, claim.key)
          resolve()
        }).then(err => {
          console.log(err)
          resolve()
        })
      })
    })
  })
})
