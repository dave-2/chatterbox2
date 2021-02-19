import '@twilio-labs/serverless-runtime-types';
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from '@twilio-labs/serverless-runtime-types/types';

const SYNC_SERVICE_ID = 'default';
const SYNC_DOCUMENT_NAME = 'status';

type RequestParameters = { Body?: string };
type Status = {
  allowMultipleOpens: boolean,
  lockTime: Date,
  phoneNumber: string,
  user: string,
  users: { [number: string]: string },
};

export const handler: ServerlessFunctionSignature = async function(
  context: Context, event: RequestParameters, callback: ServerlessCallback) {
  const client = context.getTwilioClient();
  const syncService = client.sync.services(SYNC_SERVICE_ID);

  const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
  const status: Status = document.data;

  if (new Date(status.lockTime) > new Date()) {
    const response = new Twilio.twiml.VoiceResponse();
    response.play({ digits: '9' });
    callback(null, response);

    for (const user in status.users) {
      await context.getTwilioClient().messages.create({
        body: `Door opened because ${status.users[status.user]} unlocked it. ` +
          "🦦 It's now locked.",
        from: status.phoneNumber,
        to: user,
      });
    }

    await syncService.documents(SYNC_DOCUMENT_NAME).update({
      data: {
        allowMultipleOpens: false,
        lockTime: new Date(),
        phoneNumber: status.phoneNumber,
        user: status.user,
        users: status.users,
      },
    });

    return;
  }

  const response = new Twilio.twiml.VoiceResponse();
  const dial = response.dial();
  for (const user in status.users)
    dial.number(user);
  callback(null, response);
};
