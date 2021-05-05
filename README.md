# Chatterbox 2
Programmable intercom system using Twilio Functions

## Development
Install NPM dependencies.
```
$ npm ci
```

Build.
```
$ npm run build
```

## Deployment
Change the package `name` in `package.json` to the Twilio Functions service name.
```
  "name": "my-service-name",
```

Create a `.env` file in [dotenv](https://www.npmjs.com/package/dotenv) format containing `ACCOUNT_SID` and `AUTH_TOKEN`.
```
ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AUTH_TOKEN=your_auth_token
```

Deploy to dev.
```
$ npm run deploy
```

Promote to prod.
```
$ npm run promote
```
