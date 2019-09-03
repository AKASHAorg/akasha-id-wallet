# akasha-id-lib
[DID](https://w3c-ccg.github.io/did-spec/) library for AKASHA.id, comprised of a "wallet" (integrated into the Identity Provider, IDP)and a client app.

## Client

To initialize the client, you will need a list of attributes for the application you are creating, such as the application `name`, a short `description`, an app `image URL`, and finally the `app URL`. You can also pass an optional configuration parameter (as an object).

```JavaScript
const Client = require('akasha-id-lib').Client
const config = {
    hubUrls: ['https://examplehub1.com'],
    walletUrl: 'https://akasha.id/#/wallet/',
    debug: true
}
const appInfo = {
  name: 'AKASHA.world',
  description: 'The super cool AKASHA World app!',
  icon: 'https://app.akasha.world/icon.png',
  url: 'https://app.akasha.world'
}
const client = new Client(appInfo, config)
```

**NOTE:** For convenience during development, you can start a local hub server with `npm run testhub`, which will listen on port `8080`.

The next step is to generate the initial request/login link in the app, and then display it as a button or a link for the users to click. You can also put the link in a QR code.

```JavaScript
const link = await client.registrationLink()
// -> https://akasha.id/#/wallet/WyJhIiwiMDVjZjBjNzZmMGMwZTNmNjUwODVhYTA1YmZmODFkMGI3MmI1M2VmOSIsIkVEZUJLekpwUkoyeVhUVnVncFRTQ2c9PSIsMTY4NzQ2NF0=
```

At the same time, attach an event listener for the response coming from the IDP app. The response is sent once the user has accepted or rejected the request. 

```JavaScript
const response = await client.requestProfile()
```

The response object will contain the following attributes, and it should be stored locally (client-side) for future use by the app.

```JavaScript
{
    allowed: true, // or false if the user denyed the request
    claim: { ... }, // an object containing the profile attributes shared by the user
    token: 'e6122c80e7a293901244e5cb87c32546692d5651', // unique ID for this app that is used for future requests
    refreshEncKey: '3gCE799TuL9QN5huAJ+aTg==', // one-time-use encryption key for the next request
}
```

If the app would like to request an updated version of the profile data, it can send a `refreshProfile` request.

```JavaScript
// Use the previous claim we received during the registration above
const claim = { ... }

// The token and the refreshEncKey values are taked from the previous response (above)
const response = await client.refreshProfile(claim)

console.log(response) // returns a similar response object to the one in the previous step
```

## Wallet

The "wallet" handles requests for the user's profile attributes. It is meant to be used by
the AKASHA.id application, to exchange profile attributes with 3rd party applications.

When instantiating the wallet, you can pass an optional configuration parameter (as an object)
that contains the `hubUrls`. The hubs values must be the same as the ones used by the `Client`.

```JavaScript
const Wallet = require('akasha-id-lib').Wallet

const config = {
    hubUrls: ['https://examplehub1.com'],
    debug: true // display console.log statements for debug purposes
}
// instantiate the wallet
const wallet = new Wallet(config)
// initialize
await wallet.init()
```

## Handling profiles

The wallet allows us to have multiple profiles or "personas", perhaps describing us in different ways. When using the app for the first time, you will go through a "signup"-like process, in which you provide a `name` for that profile and a `passphrase` that will be used to encrypt the local data stored by the app. The concept is very similar to creating and logging into a local account on your computer.

### Listing all profiles before login/signup

```js
const profiles = wallet.publicProfiles()
// console.log(profiles) -> []
```

### Signup

Once the `signup()` call has completed the user will be logged in by default. 

```js
const profileName = 'jane'
const passphrase = 'some super secure pass'

const id = await wallet.signup(profileName, passphrase)
// jane is now logged in, you can now list apps or do something with the profile ID
```

### Login

```js
const profiles = wallet.publicProfiles()
// console.log(profiles) -> [{id: "5285c2476202a56b05e1be3b4222402d", user: "test", picture: "https://example.org/jane.jpg"}]

// let's fake select the profile
const user = profiles[0]

// get the passphrase from a password input field

// always use the ID to call the login() method, as profile names may change in the future
await wallet.login(user.id, passphrase)

// do something like listing apps, etc.
```

### Logout

```js
await wallet.logout()
```

### Update public profile used in the list

```js
const profiles = wallet.publicProfiles()
// console.log(profiles) -> [{id: "5285c2476202a56b05e1be3b4222402d", user: "test", picture: "https://example.org/jane.jpg"}]

// pick jane's profile
const janeProfile = profiles[0]
// let's change the profile name
janeProfile.name = 'janedoe'

await wallet.updateProfileList (userId, data)
```

### Remove a profile

```js
const profiles = wallet.publicProfiles()
// console.log(profiles) -> [{id: "5285c2476202a56b05e1be3b4222402d", user: "test", picture: "https://example.org/jane.jpg"}]
// pick jane's profile
const janeProfile = profiles[0]

await wallet.removeProfile(janeProfile.id)
```

### Update the passphrase that is used to protect the encryption key

```js
await Wallet.updatePassphrase(oldPass, newPass)
```


## Handling new apps

When a user clicks the link (or scans a QR code) generated by a "client" app, they will be taken to the AKASHA.id app (i.e. the "wallet"). Once there, the link needs to be parsed in order to get to the relevant request data generated by the 3rd party app (i.e. the client).


### Register a new app based on an external request

```JavaScript
// Assuming a the link was the following
const link = 'https://akasha.id/#/wallet/WyJhIiwiMDVjZjBjNzZmMGMwZTNmNjUwODVhYTA1YmZmODFkMGI3MmI1M2VmOSIsIkVEZUJLekpwUkoyeVhUVnVncFRTQ2c9PSIsMTY4NzQ2NF0='
const rawRequest = link.substring(27) // to strip https://akasha.id/#/wallet/
// parse the link to get the initial handshake attributes
const request = await wallet.registerApp(rawRequest)
```

The `request` contents will look similar to the object below.

```JavaScript
{
    appInfo: {name: "AKASHA.world", description: "The super cool AKASHA World app!", icon: "https://app.akasha.world/icon.png", url: "https://app.akasha.world"}
    channel: "1ce120a6f8630283db7c434ce74541831b4106a2"
    key: "VCm7C1ci28M+8TFf2LA4PA=="
    nonce: 579482
    token: "4962391a0dbf2abee7e0ea4d07814aa16cc2cefc"
}
```

The wallet app can now use the `appInfo` data to display a modal/page to the user, informing them about the app that is currently requesting access to the profile elements, as well as displaying a list of available attributes from the profile that can be disclosed to the client app.

```JavaScript
...

// display a modal with data from request.appInfo as well as a list of attributes

...

// collect all the selected attributes in an attributes object
const attributes = { ... }

...

// don't forget to add the app to the user's list of allowed apps
await wallet.addApp(request.token, request.appInfo)

// send the claim
await wallet.sendClaim(request, attributes, true) 
```

You can also use `false` and `null/empty` attributes obj to deny a request. In this case you will
not have to save the app to the list though.

```JavaScript
await wallet.sendClaim(request, null, false)
```

### List all apps for a user

Returns a map of app tokens to app description objects.

```js
const apps = await wallet.apps()

// console.log(apps) -> {b783046f15ba3c8e9de9bbf2797cc87a: {name: "AKASHA.world", description: "The super cool AKASHA World app!", icon: "https://app.akasha.world/icon.png", url: "https://app.akasha.world"}}

```

### Remove an app

To remove a claim created for a specific app, you can use the app token when calling `removeApp()`.

```JavaScript
await wallet.removeApp(token)
```