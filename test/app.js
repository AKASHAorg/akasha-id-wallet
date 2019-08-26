const loginBtn = document.getElementById('login')
const refreshBtn = document.getElementById('refresh')
const startBtn = document.getElementById('start')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')
const appList = document.getElementById('list')

let appResponse = {}

const appInfo = {
  name: 'AKASHA.world',
  description: 'The super cool AKASHA World app!',
  icon: 'https://app.akasha.world/icon.png',
  url: 'https://app.akasha.world'
}

let id

try {
  const conf = JSON.parse(window.localStorage.getItem('config'))
  if (conf) {
    id = conf.id || AKASHAid.generateId()
  }
  window.localStorage.setItem('config', JSON.stringify({ id }))
} catch (e) {
  console.log(e)
}

const client = new AKASHAid.DIDclient(appInfo, { debug: true })
const wallet = new AKASHAid.DIDwallet(id, { debug: true })

const storeClaim = (claim = {}) => {
  window.localStorage.setItem(claim.token, JSON.stringify({
    key: claim.refreshEncKey,
    attributes: claim.attributes
  }))
}

const handleRefresh = async (data) => {
  try {
    const localData = JSON.parse(window.localStorage.getItem(data.token))
    if (!localData) {
      // TODO: handle revoked apps
      return
    }
    const key = await AKASHAid.crypto.importKey(localData.key)
    const msg = await AKASHAid.crypto.decrypt(key, data.msg, 'base64')
    const claim = await wallet.sendClaim({
      channel: msg.channel,
      token: data.token,
      key: localData.key,
      nonce: msg.nonce
    },
    localData.attributes,
    true)
    // persist new claim that was just issued
    storeClaim(claim)
  } catch (e) {
    console.log(e)
  }
}

const removeApp = (appToken) => {
  if (window.localStorage.getItem(appToken)) {
    // remove claim
    window.localStorage.removeItem(appToken)
    // also remove app from list
    try {
      const apps = JSON.parse(window.localStorage.getItem('apps'))
      delete apps[appToken]
      window.localStorage.setItem('apps', JSON.stringify(apps))
    } catch (e) {
      throw new Error(e)
    }
  }
}

const addApp = async (msg) => {
  if (!msg.token || !msg.appInfo) {
    throw new Error(`Missing parameter when adding app: ${token}, ${JSON.stringify(appInfo)}`)
  }
  let apps = {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem('apps'))
    if (parsed) {
      apps = parsed
    }
  } catch (e) {
    throw new Error(e)
  }

  apps[msg.token] = msg.appInfo
  window.localStorage.setItem('apps', JSON.stringify(apps))
}

const listApps = async (wallet) => {
  let apps = {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem('apps'))
    if (parsed) {
      apps = parsed
    }
  } catch (e) {
    throw new Error(e)
  }
  appList.innerHTML = ''
  if (Object.keys(apps).length === 0) {
    return
  }
  Object.keys(apps).forEach((app) => {
    const item = document.createElement('li')
    item.innerText = JSON.stringify(apps[app], null, 2)
    const removeBtn = document.createElement('button')
    removeBtn.innerText = 'Remove app'
    removeBtn.addEventListener('click', async () => {
      // remove the app
      removeApp(app)
      // refresh list of apps to reflect removed item
      listApps(wallet)
    })
    item.appendChild(removeBtn)
    appList.appendChild(item)
  })
}

loginBtn.addEventListener('click', async () => {
  const link = await client.registrationLink()
  document.getElementById('link').innerText = link
  document.getElementById('request').value = link
  try {
    const response = await client.requestProfile()
    document.getElementById('claim').innerText = JSON.stringify(response, null, 2)
    // response object
    appResponse = response
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

startBtn.addEventListener('click', async () => {
  wallet.init(handleRefresh)
  const str = document.getElementById('request').value.substring(29)
  try {
    const msg = await wallet.registerApp(str)
    console.log('RegisterApp:', msg)
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
      const claim = await wallet.sendClaim(msg, attributes, true)
      // store app into local registry
      addApp(msg)
      // also store claim
      storeClaim(claim)
      listApps(wallet)
    })
  } catch (e) {
    console.log(e)
  }
}, false)

rejectBtn.addEventListener('click', async () => {
  const str = document.getElementById('request').value.substring(29)
  try {
    const msg = await wallet.registerApp(str)
    document.getElementById('info').innerText = JSON.stringify(msg.appInfo, null, 2)
    await wallet.sendClaim(msg, null, false)
  } catch (e) {
    console.log(e)
  }
}, false)

// list apps if present
listApps()
