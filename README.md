# akasha-id-wallet
[DID](https://w3c-ccg.github.io/did-spec/) wallet library for AKASHA.id, which handles requests
for a user's persona attributes. It is meant to be used by the AKASHA.id application to
exchange profile attributes with 3rd party applications.

## Install

### Via `<script>` tag

You can call `window.AKASHAidWallet` in browsers by using `dist/akasha-id-wallet.js`.

### Via npm

`npm install --save git+https://github.com/AkashaProject/akasha-id-wallet`

```js
const Wallet = require('akasha-id-wallet')
```

# Wallet API

When instantiating the wallet, you can pass an optional configuration parameter (as an object)
that contains the list of [signalhub](https://github.com/mafintosh/signalhub) URLs (`hubUrls`),
and whether or not to output debug messages to console.

```js
const Wallet = require('akasha-id-wallet')

const config = {
    hubUrls: ['https://examplehub1.com'],
    debug: true // display console.log statements for debug purposes
}
// instantiate the wallet
const wallet = new Wallet(config)
// initialize
await wallet.init()
```

Here are some free and open signalhub servers! For serious applications though, please consider
deploying your own instances.

    * https://signalhub-jccqtwhdwc.now.sh
    * https://signalhub-hzbibrznqa.now.sh

## Handling accounts

When using the app for the first time, you will go through a signup process, in which you provide a `name` for your account as well as a `passphrase` that will be used to encrypt the local data stored by the app. The concept is very similar to creating and logging into a local account on your computer.

### Listing all accounts before login/signup

```js
const list = wallet.publicAccounts()
// console.log(list) -> []
```

### Signup

Once the `signup()` call has completed the user will be logged in by default. 

```js
const accountName = 'jane'
const passphrase = 'some super secure pass'

const id = await wallet.signup(accountName, passphrase)
// jane is now logged in, you can now list apps or do something with the account ID
```

### Login

```js
const list = wallet.publicAccounts()
// console.log(list) -> [{id: "5285c2476202a56b05e1be3b4222402d", user: "test", picture: "https://example.org/jane.jpg"}]

// let's simulate selecting the account
const user = list[0]

// get the passphrase from a password input field

// always use the ID to call the login() method, as account names can be changed by users
await wallet.login(user.id, passphrase)

// do something like listing apps, etc.
```

### Logout

```js
await wallet.logout()
```

### Update current account information used in the public list

```js
const list = wallet.publicAccounts()
// console.log(list) -> [{id: "5285c2476202a56b05e1be3b4222402d", user: "test", picture: "https://example.org/jane.jpg"}]

// pick jane's account
const jane = list[0]
// let's change the account name
jane.name = 'janedoe'

await wallet.updateAccountsList(jane)
```

### Load the current (private) account data

```js
const account = await wallet.account()
// console.log(account) -> { givenName: 'foo', email: 'foo@bar.org' }
```

### Update the current (private) account data

```js
const account = {
    name: 'foo',
    picture: 'https://example.org/picture.jpg'
}
await wallet.updateAccount(account)
```

### Remove an account

The user needs to be logged into the current account before it can be removed.

```js
await wallet.removeAccount()

const list = wallet.publicAccounts()
// console.log(list) -> []
```

### Export an account

It will export the encrypted data as one JSON object.

```js
const dump = await wallet.exportAccount()
```

### Import an account

The optional `name` parameter can be used to import the account under a different
name than the original one. Note that the unique ID remains the same!

```js
const name = 'jane from backup'
// using the dump object and the same passphrase used when creating the account above
await wallet.importAccount(dump, pass, name)
```

### Update the passphrase that is used to protect the encryption key

```js
await Wallet.updatePassphrase(oldPass, newPass)
```

## Handling personas for each account

The wallet allows an account to have multiple personas, describing us in different ways.

### Add a new persona

When creating a new persona, it is **mandatory** to at least provide the `personaName` attribute.

```js
const persona = {
    personaName: 'social'
}
await Wallet.addPersona(persona)
```

### Get the list of personas for the current account

Returns an array of objects contaning persona information.

```js
const list = await Wallet.personas()
// console.log(list) -> [ { personaName: 'social', id: '80a60dd67812d3169fc6d852d90e80c3' } ]

```

### Get the data for a given persona ID

```js
const persona = await Wallet.persona(personaID)
```

### Update persona information for a given persona ID

```js
const data = await Wallet.persona(personaID)
data.personaName = 'work' // used to be "social"
}
await wallet.updatePersona(data)
```

### Remove a specific persona based on the ID of that persona

```js
await Wallet.removePersona(personaID)
```

## Handling new apps

When a user clicks the link (or scans a QR code) generated by a "client" app, they will be taken to the AKASHA.id app (i.e. the "wallet"). Once there, the link needs to be parsed in order to get to the relevant request data generated by the 3rd party app (i.e. the client).


### Register a new app based on an external request

```js
// Assuming a the link was the following
const link = 'https://akasha.id/#/wallet/WyJhIiwiMDVjZjBjNzZmMGMwZTNmNjUwODVhYTA1YmZmODFkMGI3MmI1M2VmOSIsIkVEZUJLekpwUkoyeVhUVnVncFRTQ2c9PSIsMTY4NzQ2NF0='
const rawRequest = link.substring(27) // to strip https://akasha.id/#/wallet/
// parse the link to get the initial handshake attributes
const request = await wallet.registerApp(rawRequest)
```

The `request` contents will look similar to the object below.

```js
{
    appInfo: {name: "AKASHA.world", description: "The super cool AKASHA World app!", icon: "https://app.akasha.world/icon.png", url: "https://app.akasha.world"},
    attributes: ['name', 'email'],
    channel: "1ce120a6f8630283db7c434ce74541831b4106a2"
    key: "VCm7C1ci28M+8TFf2LA4PA=="
    nonce: 579482
    token: "4962391a0dbf2abee7e0ea4d07814aa16cc2cefc"
}
```

The wallet app can now use the `appInfo` data to display a modal/page to the user, informing them about the app that is currently requesting access to the persona elements. At the same time, it
can also inform the user at to what attributes they should disclose specifically for this app --
e.g. `attributes: ['name', 'email']` above -- out of all the persona attributes they may have in
their AKASHA.id persona.

```js
...

// display a modal with data from request.appInfo as well as a list of attributes

...

// collect all the selected attributes in an attributes object based on what the user
// has decided to allow (in this case only sharing the name and not the email)
const attributes = {
    name: true,
    email: false
}

...

// add the app to the user's list of allowed apps
// the personaID must also be specified
await wallet.addApp(request, personaID, attributes)

// accept the request and send the claim
await wallet.sendClaim(request, true) 
```

You can also use `false` and `null/empty` attributes obj to deny a request. In this case you should
not have to save the app to the list before sending the claim.

```js
await wallet.sendClaim(request, false)
```

### List all apps for a given persona ID

Returns an array of app objects.

```js
const apps = await wallet.apps(personaID)

// console.log(apps) -> [ { id: "4962391a0dbf2abee7e0ea4d07814aa16cc2cefc", persona: "80a60dd67812d3169fc6d852d90e80c3", appInfo: { name: "AKASHA.world", description: "The super cool AKASHA World app!", icon: "https://app.akasha.world/icon.png", url: "https://app.akasha.world" }, attributes: { name: true, email: true, address: false } } ]

```

### Remove an app

To remove an app, you can use the app token when calling `removeApp()`.

```js
await wallet.removeApp(token)
```