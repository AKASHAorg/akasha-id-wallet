const loginBtn = document.getElementById('login')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')

const testClaim = {
    "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org/"],
    "type": ["VerifiableCredential", "IdentityCredential"],
    "issuer": "did:akasha:b0a3ca3d0126c4f4a951a46246de0712b7637b8f",
    "issuanceDate": "2019-08-14T19:73:24Z",
    "credentialSubject": {
        "id": "did:akasha:b0a3ca3d0126c4f4a951a46246de0712b7637b8f",
        "name": "J. Doe",
        "address": {
            "streetAddress": "10 Rue de Chose",
            "postalCode": "98052",
            "addressLocality": "Paris",
            "addressCountry": "FR"
        },
        "birthDate": "1982-03-15"
    },
    "proof": {}
}

loginBtn.addEventListener('click', async () => {
    const client = new AKASHAid.DIDclient('a','b','c','d', {debug: true})
    const link = await client.genLoginLink()
    document.getElementById('link').innerText = link
    document.getElementById('request').value = link
    try {
        await client.bootstrapNewLogin((response) => { // success
            console.log(response)
            document.getElementById('claim').innerText = JSON.stringify(response,null,2)
        },
        (response) => { // fail
            console.log(response)
            document.getElementById('claim').innerText = JSON.stringify(response,null,2)
        })
    } catch (e) {
        console.log(e)
    }
}, false)

acceptBtn.addEventListener('click', async () => {
    wallet = new AKASHAid.DIDwallet()
    const str = document.getElementById('request').value.substring(29)
    const req = wallet.parseLoginLink(str)
    await wallet.respondToLogin(req[1], req[2], req[3], testClaim, 'allowed')
}, false)

rejectBtn.addEventListener('click', async () => {
    const wallet = new AKASHAid.DIDwallet()
    const str = document.getElementById('request').value.substring(29)
    const req = wallet.parseLoginLink(str)
    await wallet.respondToLogin(req[1], req[2], req[3], null, 'denied')
}, false)