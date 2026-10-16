import "@twilio-labs/serverless-runtime-types";
import type {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { notifyUsers } from "../shared/message";
import { getStatus } from "../shared/status";

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

  await notifyUsers(
    context,
    status,
    (number) =>
      `${number === event.To ? "You" : status.users[event.To]} answered the door. 🐕`,
  );
}
