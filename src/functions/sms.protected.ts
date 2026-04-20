import "@twilio-labs/serverless-runtime-types";
import {
  Context,
  ServerlessCallback,
  ServerlessEventObject,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

const SYNC_SERVICE_ID = "default";
const SYNC_DOCUMENT_NAME = "status";

type RequestParameters = { Body: string; From: string } & ServerlessEventObject;
type Status = {
  allowMultipleOpens: boolean;
  lockTime: Date;
  phoneNumber: string;
  user: string;
  users: { [number: string]: string };
  guests: { [number: string]: string };
};

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
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
  const status: Status = document.data;

  const isUser = status.users.hasOwnProperty(event.From);
  const isGuest = status.guests.hasOwnProperty(event.From);

  if (!isUser && !isGuest) return "No permissions to grant access. :(";

  const command = event.Body.split(" ")[0].toLowerCase();

  if (isGuest) {
    if (command === "unlock") {
      return handleUnlock(context, status, event.From, 5, false);
    }
    return "Guests can only use the 'unlock' command. 🔒";
  }

  const match = /^([0-9]+)(\+?)/.exec(command);
  if (match) {
    const minutes = Number(match[1]);
    const allowMultipleOpens = Boolean(match[2]);
    return handleUnlock(
      context,
      status,
      event.From,
      minutes,
      allowMultipleOpens,
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

async function handleUnlock(
  context: Context,
  status: Status,
  user: string,
  minutes: number,
  allowMultipleOpens: boolean,
): Promise<string> {
  const lockTime = new Date();
  lockTime.setMinutes(lockTime.getMinutes() + minutes);

  const newStatus = { allowMultipleOpens, lockTime, user };
  await updateStatus(context, status, newStatus);

  const timeOptions = { timeZone: "America/Los_Angeles" };
  const timeString = lockTime.toLocaleTimeString("en-US", timeOptions);
  return (
    `You added ${minutes} minutes! 🐿 ` +
    `The door's unlocked until ${timeString}.`
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

  return `Added guest ${name} at ${number}. 🐿`;
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
  const newStatus = { allowMultipleOpens: false, lockTime: new Date(), user };
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

async function updateStatus(context: Context, status: Status, newStatus: any) {
  const data = { ...status, ...newStatus };
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  await syncService.documents(SYNC_DOCUMENT_NAME).update({ data });
}
