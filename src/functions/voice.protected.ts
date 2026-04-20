import "@twilio-labs/serverless-runtime-types";
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { getStatus, updateStatus, Status } from "../shared/status";

type RequestParameters = {} & ServerlessEventObject;

export const handler: ServerlessFunctionSignature<{}, RequestParameters> =
  async function (
    context: Context,
    event: RequestParameters,
    callback: ServerlessCallback,
  ) {
    try {
      callback(null, await main(context, event));
    } catch (error) {
      callback(String(error));
    }
  };

async function main(context: Context, event: RequestParameters) {
  const status = await getStatus(context);

  if (new Date(status.lockTime) > new Date()) {
    return handleOpen(context, status);
  }

  return handleDial(status);
}

async function handleOpen(context: Context, status: Status) {
  for (const number in status.users) {
    const unlockDurationMs = new Date(status.lockTime).getTime() - Date.now();
    const unlockDurationMinutes = Math.floor(unlockDurationMs / 60000);
    const lockStatus = status.allowMultipleOpens
      ? `It's unlocked for ${unlockDurationMinutes} more minutes.`
      : "It's now locked.";

    const senderName =
      status.users[status.user] || status.guests[status.user] || "someone";

    await context.getTwilioClient().messages.create({
      body: `Door opened because ${senderName} unlocked it. 🦦 ` + lockStatus,
      from: status.phoneNumber,
      to: number,
    });
  }

  if (!status.allowMultipleOpens) {
    const newStatus = { lockTime: new Date() };
    await updateStatus(context, status, newStatus);
  }

  const response = new Twilio.twiml.VoiceResponse();
  response.play({ digits: "9" });
  return response;
}

async function handleDial(status: Status) {
  const response = new Twilio.twiml.VoiceResponse();
  const dial = response.dial({ answerOnBridge: true });
  for (const number in status.users) {
    dial.number(
      {
        statusCallback: "/dialCallback",
        statusCallbackEvent: ["answered"],
      },
      number,
    );
  }
  return response;
}
