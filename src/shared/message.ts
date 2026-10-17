import type { Context } from "@twilio-labs/serverless-runtime-types/types";

import type { Status } from "./status";

export function formatMessage(
  status: Status,
  to: string,
  message: string,
): string {
  const isSubscribed = Boolean(status.users[to] || status.guests[to]);
  const suffix = isSubscribed ? " Reply STOP to opt out." : "";
  return `${status.brandName}: ${message}${suffix}`;
}

export async function notifyUsers(
  context: Context,
  status: Status,
  getMessage: (number: string) => string,
): Promise<void> {
  for (const number in status.users) {
    await context.getTwilioClient().messages.create({
      body: formatMessage(status, number, getMessage(number)),
      from: status.phoneNumber,
      to: number,
    });
  }
}
