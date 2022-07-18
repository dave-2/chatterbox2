import "@twilio-labs/serverless-runtime-types";
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

const SYNC_SERVICE_ID = "default";
const SYNC_DOCUMENT_NAME = "status";

type RequestParameters = {} & ServerlessEventObject;
type Status = {
  allowMultipleOpens: boolean;
  lockTime: Date;
  phoneNumber: string;
  user: string;
  users: { [number: string]: string };
};

export const handler: ServerlessFunctionSignature<{}, RequestParameters> =
  async function (
    context: Context,
    event: RequestParameters,
    callback: ServerlessCallback
  ) {
    try {
      callback(null, await main(context, event));
    } catch (error) {
      callback(String(error));
    }
  };

async function main(context: Context, event: RequestParameters) {
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
  const status: Status = document.data;

  if (new Date(status.lockTime) > new Date()) {
    return handleOpen(context, status);
  }

  return handleDial(status);
}

async function handleOpen(context: Context, status: Status) {
  for (const user in status.users) {
    await context.getTwilioClient().messages.create({
      body:
        `Door opened because ${status.users[status.user]} unlocked it. ` +
        "🦦 It's now locked.",
      from: status.phoneNumber,
      to: user,
    });
  }

  const newStatus = { allowMultipleOpens: false, lockTime: new Date() };
  await updateStatus(context, status, newStatus);

  const response = new Twilio.twiml.VoiceResponse();
  response.play({ digits: "9" });
  return response;
}

async function handleDial(status: Status) {
  const response = new Twilio.twiml.VoiceResponse();
  const dial = response.dial({ answerOnBridge: true });
  for (const user in status.users) {
    dial.number(
      {
        statusCallback: "/dialCallback",
        statusCallbackEvent: ["answered"],
      },
      user
    );
  }
  return response;
}

async function updateStatus(context: Context, status: Status, newStatus: any) {
  const data = { ...status, ...newStatus };
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  await syncService.documents(SYNC_DOCUMENT_NAME).update({ data });
}
