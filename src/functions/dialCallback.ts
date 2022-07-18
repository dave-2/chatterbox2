import "@twilio-labs/serverless-runtime-types";
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

const SYNC_SERVICE_ID = "default";
const SYNC_DOCUMENT_NAME = "status";

type RequestParameters = {
  CallStatus: string;
  To: string;
} & ServerlessEventObject;
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
      await main(context, event);
      callback(null);
    } catch (error) {
      callback(String(error));
    }
  };

async function main(context: Context, event: RequestParameters): Promise<void> {
  if (event.CallStatus !== "in-progress") return;

  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
  const status: Status = document.data;

  for (const user in status.users) {
    if (user === event.To) continue;

    await context.getTwilioClient().messages.create({
      body: `${status.users[event.To]} answered the door. 🐕`,
      from: status.phoneNumber,
      to: user,
    });
  }
}
