const loginBtn = document.getElementById('login')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')

const client = new AKASHAid.DIDclient('a', 'b', 'c', 'd', { debug: true })
const wallet = new AKASHAid.DIDwallet({ debug: true })
let appResponse = {}
const attributes = (did) => {
  return {
    id: did,
    name: 'J. Doe',
    address: {
      streetAddress: '10 Rue de Chose',
      postalCode: '98052',
      addressLocality: 'Paris',
      addressCountry: 'FR'
    },
    birthDate: '1982-03-15'
  }
}

loginBtn.addEventListener('click', async () => {
  const link = await client.genLoginLink()
  document.getElementById('link').innerText = link
  document.getElementById('request').value = link
  try {
    const response = await client.requestProfile()
    document.getElementById('claim').innerText = JSON.stringify(response, null, 2)
    // response object
    appResponse = response
    // get the channel ID for refresh from the user's DID in the claim
    const channel = appResponse['claim']['credentialSubject']['id'].split(':')[2]
    // create refresh button
    const refreshBtn = document.createElement('button')
    refreshBtn.innerText = 'Refresh profile'
    refreshBtn.addEventListener('click', async () => {
      try {
        const res = await client.refreshProfile(channel, appResponse.token, appResponse.refreshEncKey)
        console.log('Refresh profile:', res)
        document.getElementById('claim').innerText = JSON.stringify(res, null, 2)
        appResponse = res
      } catch (e) {
        console.log(e)
      }
    }, false)
    document.getElementsByTagName('body')[0].appendChild(refreshBtn)
  } catch (e) {
    console.log(e)
  }
}, false)

acceptBtn.addEventListener('click', async () => {
  wallet.init()
  const str = document.getElementById('request').value.substring(29)
  try {
    const parsed = wallet.parseRegisterLink(str)
    const msg = await wallet.registerApp(parsed)
    console.log(msg)
    parsed.token = msg.token
    parsed.rawKey = msg.key
    await wallet.sendClaim(parsed, attributes(wallet.did()), true)
  } catch (e) {
    console.log(e)
  }
}, false)

rejectBtn.addEventListener('click', async () => {
  wallet.init()
  const str = document.getElementById('request').value.substring(29)
  try {
    const parsed = wallet.parseRegisterLink(str)
    await wallet.sendClaim(parsed, null, false)
  } catch (e) {
    console.log(e)
  }
}, false)
