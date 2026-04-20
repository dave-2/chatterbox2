# Chatterbox 2

A programmable intercom system built on Twilio Serverless.

## Development

- **Install dependencies**
  ```bash
  npm ci
  ```
- **Build**
  ```bash
  npm run build
  ```
- **Test**
  ```bash
  npm test
  ```
- **Format**
  ```bash
  npm run format
  ```

## Deployment

1. **Configure Environment**

   Create a `.env` file with your Twilio credentials and service name:

   ```env
   ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   AUTH_TOKEN=your_auth_token
   SERVICE_NAME=your-service-name
   ```

1. **Deploy to Dev**

   ```bash
   npm run deploy
   ```

1. **Promote to Production**
   ```bash
   npm run promote
   ```
