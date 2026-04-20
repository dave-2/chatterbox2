import "@twilio-labs/serverless-runtime-types";
import type {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { getStatus } from "../shared/status";
import type { Status } from "../shared/status";

type RequestParameters = {
  CallStatus: string;
  To: string;
} & ServerlessEventObject;

export const handler: ServerlessFunctionSignature<{}, RequestParameters> =
  async function (
    context: Context,
    event: RequestParameters,
    callback: ServerlessCallback,
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

  const status = await getStatus(context);

  for (const number in status.users) {
    await context.getTwilioClient().messages.create({
      body: `${number === event.To ? "You" : status.users[event.To]} answered the door. 🐕`,
      from: status.phoneNumber,
      to: number,
    });
  }
}
