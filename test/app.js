const loginBtn = document.getElementById('login')
const refreshBtn = document.getElementById('refresh')
const startBtn = document.getElementById('start')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')
const appList = document.getElementById('list')
const signupBtn = document.getElementById('signup')

let appResponse = {}

const appInfo = {
  name: 'AKASHA.world',
  description: 'The super cool AKASHA World app!',
  icon: 'https://app.akasha.world/icon.png',
  url: 'https://app.akasha.world'
}

const client = new window.AKASHAid.Client(appInfo, { debug: true })
const wallet = new window.AKASHAid.Wallet({ debug: true })

const listApps = async (wallet) => {
  const apps = await wallet.apps()
  appList.innerHTML = ''
  Object.keys(apps).forEach((app) => {
    const item = document.createElement('li')
    item.innerText = JSON.stringify(apps[app], null, 2)
    const removeBtn = document.createElement('button')
    removeBtn.innerText = 'Remove app'
    removeBtn.addEventListener('click', async () => {
      await wallet.removeApp(app)
      listApps(wallet)
    })
    item.appendChild(removeBtn)
    appList.appendChild(item)
  })
}

loginBtn.addEventListener('click', async () => {
  // listen
  const link = await client.registrationLink()
  document.getElementById('link').innerText = link
  document.getElementById('request').value = link
  try {
    const response = await client.requestProfile()
    document.getElementById('claim').innerText = JSON.stringify(response, null, 2)
    // response object
    appResponse = response
    console.log(response)
    // get the channel ID for refresh from the user's DID in the claim
    const channel = appResponse['claim']['credentialSubject']['id'].split(':')[2]
    // add listener for refresh button
    refreshBtn.addEventListener('click', async () => {
      try {
        const res = await client.refreshProfile(channel, appResponse.token, appResponse.refreshEncKey)
        document.getElementById('claim').innerText = JSON.stringify(res, null, 2)
        appResponse = res
      } catch (e) {
        console.log(e)
      }
    }, false)
  } catch (e) {
    console.log(e)
  }
}, false)

// register/login user
signupBtn.addEventListener('click', async () => {
  await wallet.init()
  const profiles = wallet.publicProfiles()
  if (Object.keys(profiles).length > 0) {
    const user = Object.keys(profiles)[0]
    await wallet.login(user, 'pass')
    console.log('Logged in as user >>', profiles[user].user)
  } else {
    await wallet.signup('test', 'pass')
  }
  listApps(wallet)
}, false)

startBtn.addEventListener('click', async () => {
  const str = document.getElementById('request').value.substring(29)
  try {
    const msg = await wallet.registerApp(str)
    document.getElementById('info').innerText = JSON.stringify(msg.appInfo, null, 2)
    const attributes = {
      name: 'J. Doe',
      address: {
        streetAddress: '10 Rue de Chose',
        postalCode: '98052',
        addressLocality: 'Paris',
        addressCountry: 'FR'
      },
      birthDate: '1982-03-15'
    }
    // add listener to accept button
    acceptBtn.addEventListener('click', async () => {
      await wallet.sendClaim(msg, attributes, true)
      listApps(wallet)
    })
  } catch (e) {
    console.log(e)
  }
}, false)

rejectBtn.addEventListener('click', async () => {
  wallet.init()
  const str = document.getElementById('request').value.substring(29)
  try {
    const msg = await wallet.registerApp(str)
    document.getElementById('info').innerText = JSON.stringify(msg.appInfo, null, 2)
    await wallet.sendClaim(msg, null, false)
  } catch (e) {
    console.log(e)
  }
}, false)
