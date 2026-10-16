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

## Initial Setup

1. **Configure Twilio Sync (`status` document)**

   In the Twilio Console, go to **Sync → Services → Default → Documents** and create or edit the document with unique name `status`. Set your Twilio phone number, brand name, and initial household user:

   ```json
   {
     "brandName": "Chatterbox",
     "phoneNumber": "+14155550100",
     "users": {
       "+14155550199": "Alice"
     }
   }
   ```

   - `brandName`: The sender/program name prefixed to all outgoing SMS messages (defaults to `"Chatterbox"` if omitted).
   - `phoneNumber`: The Twilio phone number (in E.164 format) used to send outbound SMS notifications.
   - `users`: Map of authorized household phone numbers (E.164 format) to names. Once the first user is added here, additional users and guests can be managed via SMS commands (`adduser`, `removeuser`, `addguest`, `removeguest`).

1. **Configure Twilio Phone Number Webhooks**

   In the Twilio Console under **Phone Numbers → Manage → Active numbers**, select your Twilio phone number and point its webhooks to your deployed Serverless service:
   - **A call comes in**: Function → `/voice`
   - **A message comes in**: Function → `/sms`
