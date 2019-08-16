const loginBtn = document.getElementById('login')
const acceptBtn = document.getElementById('accept')
const rejectBtn = document.getElementById('reject')

let client, wallet
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
    client = new AKASHAid.DIDclient('a','b','c','d')
    const link = await client.genLoginLink()
    document.getElementById('link').innerText = link
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
    const req = wallet.parseLoginLink(document.getElementById('request').value)  
    await wallet.respondToLogin(req[2], req[1], testClaim, 'allowed')
}, false)

rejectBtn.addEventListener('click', async () => {
    wallet = new AKASHAid.DIDwallet()
    const req = wallet.parseLoginLink(document.getElementById('request').value)
    await wallet.respondToLogin(req[2], req[1], null, 'denied')
}, false)