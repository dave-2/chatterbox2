import type { Context } from "@twilio-labs/serverless-runtime-types/types";

import type { Status } from "./status";

export function formatMessage(status: Status, message: string): string {
  return `${status.brandName}: ${message} Reply STOP to opt out.`;
}

export async function notifyUsers(
  context: Context,
  status: Status,
  getMessage: (number: string) => string,
): Promise<void> {
  for (const number in status.users) {
    await context.getTwilioClient().messages.create({
      body: formatMessage(status, getMessage(number)),
      from: status.phoneNumber,
      to: number,
    });
  }
}
