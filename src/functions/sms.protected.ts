import "@twilio-labs/serverless-runtime-types";
import type {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

import { formatMessage } from "../shared/message";
import { getStatus, updateStatus } from "../shared/status";
import type { Status } from "../shared/status";

type RequestParameters = { Body: string; From: string } & ServerlessEventObject;

export const handler: ServerlessFunctionSignature<{}, RequestParameters> =
  async function (
    context: Context,
    event: RequestParameters,
    callback: ServerlessCallback,
  ) {
    try {
      const response = new Twilio.twiml.MessagingResponse();
      response.message(await main(context, event));
      callback(null, response);
    } catch (error) {
      callback(String(error));
    }
  };

async function main(
  context: Context,
  event: RequestParameters,
): Promise<string> {
  const status = await getStatus(context);
  const message = await handleCommand(context, status, event);
  return formatMessage(status, message);
}

const TIME_ZONE = "America/Los_Angeles";

async function handleCommand(
  context: Context,
  status: Status,
  event: RequestParameters,
): Promise<string> {
  const isUser = !!status.users[event.From];
  const isGuest = !!status.guests[event.From];
  const isRegistered = isUser || isGuest;
  const command = event.Body.split(" ")[0].toLowerCase();

  switch (command) {
    case "help":
    case "info":
      return handleHelp(status, isRegistered);
    case "start":
    case "yes":
    case "unstop":
      return handleStart(isRegistered);
    case "stop":
    case "stopall":
    case "unsubscribe":
    case "cancel":
    case "end":
    case "quit":
      return handleStop(context, status, event.From, isRegistered);
  }

  if (!isRegistered) return "No permissions to grant access. :(";

  if (command === "unlock") {
    return handleUnlock(context, status, event.From, 5, false);
  }

  if (isGuest) return "Guests can only use the 'unlock' command. 🔒";

  const match = /^([0-9]+)(\+?)(?:\s+(.+))?$/.exec(event.Body.trim());
  if (match) {
    const minutes = Number(match[1]);
    const allowMultipleOpens = Boolean(match[2]);
    const scheduleArgs = match[3];
    if (!scheduleArgs) {
      return handleUnlock(
        context,
        status,
        event.From,
        minutes,
        allowMultipleOpens,
      );
    }

    const atMatch = /^at (\d{1,2}:\d{2}(?: (?:am|pm))?)$/i.exec(scheduleArgs);
    const unlockTime = atMatch ? parseTime(atMatch[1]) : null;
    if (!unlockTime) {
      return (
        "Syntax: <minutes>[+] at <H:MM [AM|PM] " +
        "(Ex: 30 at 15:00 or 30+ at 3:00 PM)>"
      );
    }
    return handleUnlock(
      context,
      status,
      event.From,
      minutes,
      allowMultipleOpens,
      unlockTime,
    );
  }

  switch (command) {
    case "addguest":
      return handleAddGuest(context, status, event.Body);
    case "adduser":
      return handleAddUser(context, status, event.Body);
    case "lock":
      return handleLock(context, status, event.From);
    case "removeguest":
      return handleRemoveGuest(context, status, event.From, event.Body);
    case "removeuser":
      return handleRemoveUser(context, status, event.From, event.Body);
    case "status":
      return handleStatus(status);
    default:
      return "Could not understand. 🐼 Try giving me a number.";
  }
}

function handleHelp(status: Status, isRegistered: boolean): string {
  if (!isRegistered) {
    return "Contact the household owner for support. 🛟";
  }
  return (
    "Text 'unlock' (or a number of minutes) to unlock the door, or 'lock' to lock it. " +
    `Contact the household owner at ${status.phoneNumber} for support. Reply STOP to opt out. 🛟`
  );
}

function handleStart(isRegistered: boolean): string {
  if (!isRegistered) {
    return "Messaging is enabled! Contact the household owner to be added to intercom alerts. 🟢";
  }
  return (
    "You are subscribed to intercom alerts. Message frequency varies. " +
    "Message and data rates may apply. Reply HELP for help. Reply STOP to opt out. 🟢"
  );
}

async function handleStop(
  context: Context,
  status: Status,
  from: string,
  isRegistered: boolean,
): Promise<string> {
  if (isRegistered) {
    delete status.users[from];
    delete status.guests[from];
    await updateStatus(context, status, {
      guests: status.guests,
      users: status.users,
    });
  }

  return (
    "You have been unsubscribed and will receive no further messages. 🛑 " +
    "Reply START and contact the household owner to resubscribe."
  );
}

/** Parses a time string (H:MM or H:MM AM/PM) for today or tomorrow in TIME_ZONE. */
function parseTime(timeStr: string): Date | null {
  const now = new Date();
  const localNow = new Date(
    now.toLocaleString("en-US", { timeZone: TIME_ZONE }),
  );
  const target = new Date(`${localNow.toDateString()} ${timeStr}`);
  if (isNaN(target.getTime())) return null;

  if (target <= localNow) target.setDate(target.getDate() + 1);
  return new Date(now.getTime() + (target.getTime() - localNow.getTime()));
}

async function handleUnlock(
  context: Context,
  status: Status,
  user: string,
  minutes: number,
  allowMultipleOpens: boolean,
  scheduledTime?: Date,
): Promise<string> {
  const unlockTime = scheduledTime ?? new Date();
  const lockTime = new Date(unlockTime.getTime() + minutes * 60000);

  const newStatus = { allowMultipleOpens, unlockTime, lockTime, user };
  await updateStatus(context, status, newStatus);

  const timeOptions: Intl.DateTimeFormatOptions = {
    timeStyle: "short",
    timeZone: TIME_ZONE,
  };
  const endString = lockTime.toLocaleTimeString("en-US", timeOptions);

  if (scheduledTime) {
    const startString = unlockTime.toLocaleTimeString("en-US", timeOptions);
    return (
      `Scheduled ${minutes} minutes! 🐿️ ` +
      `The door will unlock from ${startString} to ${endString}.`
    );
  }

  return (
    `You added ${minutes} minutes! 🐿️ ` +
    `The door's unlocked until ${endString}.`
  );
}

async function handleAddGuest(
  context: Context,
  status: Status,
  body: string,
): Promise<string> {
  const match = body.match(/^addguest (\w+) (\+1\d{10})$/i);
  if (!match)
    return (
      "Syntax: AddGuest <name> " +
      "<phone number in E.164 format (Ex: +14151234567)>"
    );

  const [_, name, number] = match;
  const newStatus = { guests: { ...status.guests, [number]: name } };
  await updateStatus(context, status, newStatus);

  return `Added guest ${name} at ${number}. 🐿️`;
}

async function handleAddUser(
  context: Context,
  status: Status,
  body: string,
): Promise<string> {
  const match = body.match(/^adduser (\w+) (\+1\d{10})$/i);
  if (!match)
    return (
      "Syntax: AddUser <name> " +
      "<phone number in E.164 format (Ex: +14151234567)>"
    );

  const [_, name, number] = match;
  const newStatus = { users: { ...status.users, [number]: name } };
  await updateStatus(context, status, newStatus);

  return `Added ${name} at ${number}. 🦆`;
}

async function handleLock(
  context: Context,
  status: Status,
  user: string,
): Promise<string> {
  const newStatus = {
    allowMultipleOpens: false,
    unlockTime: new Date(0),
    lockTime: new Date(),
    user,
  };
  await updateStatus(context, status, newStatus);

  return (
    "The door's locked. 🦡 " +
    "Reply back with a number of minutes to re-unlock."
  );
}

async function handleRemoveGuest(
  context: Context,
  status: Status,
  user: string,
  body: string,
): Promise<string> {
  const match = body.match(/^removeguest (\w+)$/i);
  if (!match) return "Syntax: RemoveGuest <name>";

  const [_, inputName] = match;
  for (const number in status.guests) {
    const userName = status.guests[number];
    if (userName.toLowerCase() === inputName.toLowerCase()) {
      delete status.guests[number];
      await updateStatus(context, status, { guests: status.guests });
      return `Removed guest ${userName}. 🦆`;
    }
  }

  return `I don't know guest ${inputName}. 🐢`;
}

async function handleRemoveUser(
  context: Context,
  status: Status,
  user: string,
  body: string,
): Promise<string> {
  const match = body.match(/^removeuser (\w+)$/i);
  if (!match) return "Syntax: RemoveUser <name>";

  const [_, inputName] = match;
  for (const number in status.users) {
    const userName = status.users[number];
    if (userName.toLowerCase() === inputName.toLowerCase()) {
      if (number === user) return "Can't remove yourself, dummy! 🐓";

      delete status.users[number];
      await updateStatus(context, status, { users: status.users });
      return `Removed ${userName}. 🦆`;
    }
  }

  return `I don't know ${inputName}. 🐢`;
}

function handleStatus(status: Status): string {
  const stringifier = ([key, value]: [string, any]) => {
    return `${key}: ${JSON.stringify(value)}`;
  };
  return Object.entries(status).map(stringifier).join("\n");
}
