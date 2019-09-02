/* eslint-env mocha */
/* global chai */

const AKASHAid = window.AKASHAid

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
  const profilePass = 'password1'

  let Client
  let Wallet

  context('Init Client', () => {
    it('Should fail to instantiate Client without appInfo', () => {
      let err
      try {
        Client = new AKASHAid.Client(undefined, {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing app details')
    })

    it('Should fail to instantiate Client without config', () => {
      let err
      try {
        Client = new AKASHAid.Client(appInfo, undefined)
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Client = new AKASHAid.Client(appInfo, {})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Client = new AKASHAid.Client(appInfo, { hubUrls: 'http://localhost:8888' })
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Client = new AKASHAid.Client(appInfo, { walletUrl: 'http://localhost:8888' })
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')
    })

    it('Should successfully instantiate Client with proper parameters', () => {
      let err
      try {
        Client = new AKASHAid.Client(appInfo, config)
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })
  })

  context('Init Wallet', () => {
    it('Should fail to instantiate Wallet without config', () => {
      let err
      try {
        Wallet = new AKASHAid.Wallet()
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Wallet = new AKASHAid.Wallet({})
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')

      try {
        Wallet = new AKASHAid.Wallet({ debug: true })
      } catch (error) {
        err = error
      }
      chai.assert.equal(err.message, 'Missing config details')
    })

    it('Should successfully init Wallet with proper parameters', async () => {
      let err
      try {
        Wallet = new AKASHAid.Wallet(config)
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
      console.log(Wallet.hub)
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
        await Wallet.addClaim('foo', 'bar', { foo: 'bar' })
      } catch (error) {
        err = error
      }
      chai.assert.isUndefined(err)
    })

    it('Should successfully get a claim using the provided token', async () => {
      const claim = await Wallet.getClaim('foo')

      chai.assert.deepEqual(claim.attributes, { foo: 'bar' })
      chai.assert.equal(claim.key, 'bar')
    })

    it('Should successfully remove a claim using the provided token', async () => {
      await Wallet.removeClaim('foo')
      const claim = await Wallet.getClaim('foo')

      chai.assert.isUndefined(claim)
    })
  })

  context('Client', () => {
    it('Should successfully generate registrationLink', async () => {
      const link = await Client.registrationLink()
      const walletStr = link.substring(0, config.walletUrl.length)
      const reqStr = link.substring(config.walletUrl.length)

      chai.assert.equal(walletStr, config.walletUrl)
      chai.assert.equal(reqStr.length, 96)
    })
  })
})
