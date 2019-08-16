const loginBtn = document.getElementById('login')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')

const client = new AKASHAid.DIDclient('a', 'b', 'c', 'd', { debug: true })
const wallet = new AKASHAid.DIDwallet({ debug: true })

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
    const response = await client.bootstrapNewLogin()
    document.getElementById('claim').innerText = JSON.stringify(response, null, 2)

    const refreshBtn = document.createElement('button')
    refreshBtn.innerText = 'Refresh profile'
    refreshBtn.addEventListener('click', async () => {
      try {
        const res = await client.refreshProfile(response.queryChannel, response.token, response.refreshEncKey)
        console.log('Refresh profile:', res)
        document.getElementById('claim').innerText = JSON.stringify(res, null, 2)
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
    const req = wallet.parseLoginLink(str)
    await wallet.sendClaim(req[1], req[2], req[3], attributes(wallet.did()), 'allowed')
  } catch (e) {
    console.log(e)
  }
}, false)

rejectBtn.addEventListener('click', async () => {
  wallet.init()
  const str = document.getElementById('request').value.substring(29)
  try {
    const req = wallet.parseLoginLink(str)
    await wallet.sendClaim(req[1], req[2], req[3], null, 'denied')
  } catch (e) {
    console.log(e)
  }
}, false)
