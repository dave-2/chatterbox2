import '@twilio-labs/serverless-runtime-types';
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from '@twilio-labs/serverless-runtime-types/types';

const SYNC_SERVICE_ID = 'default';
const SYNC_DOCUMENT_NAME = 'status';

type RequestParameters = { Body?: string, From?: string };
type Status = {
  allowMultipleOpens: boolean,
  lockTime: Date,
  phoneNumber: string,
  user: string,
  users: { [number: string]: string },
};

export const handler: ServerlessFunctionSignature = async function (
  context: Context, event: RequestParameters, callback: ServerlessCallback) {
  const response = new Twilio.twiml.MessagingResponse();
  try {
    response.message(await main(context, event));
  } catch (error) {
    response.message(`There was an error :( ${error}`);
  }
  return callback(null, response)
}

async function main(context: Context, event: RequestParameters) {
  const client = context.getTwilioClient();
  const syncService = client.sync.services(SYNC_SERVICE_ID);

  const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
  const status: Status = document.data;

  if (!event.From || !status.users.hasOwnProperty(event.From))
    return 'No permissions to grant access. :(';

  const minutes = Number(event.Body);
  if (!isNaN(minutes)) {
    const lockTime = new Date();
    lockTime.setMinutes(lockTime.getMinutes() + minutes);
    await syncService.documents(SYNC_DOCUMENT_NAME).update({
      data: {
        allowMultipleOpens: false,
        lockTime,
        phoneNumber: status.phoneNumber,
        user: event.From,
        users: status.users,
      },
    });

    const timeString =
      lockTime.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' });
    return `You added ${minutes} minutes! 🐿 ` +
      `The door's unlocked until ${timeString}.`;
  }

  if (event.Body && (event.Body.toLowerCase() === 'close' ||
    event.Body.toLowerCase() === 'lock')) {
    await syncService.documents(SYNC_DOCUMENT_NAME).update({
      data: {
        allowMultipleOpens: false,
        lockTime: new Date(),
        phoneNumber: status.phoneNumber,
        user: event.From,
        users: status.users,
      },
    });

    return "The door's locked. 🦡 " +
      'Reply back with a number of minutes to re-unlock.';
  }

  return 'Could not understand. 🐼 Try giving me a number.';
};
