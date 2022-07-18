import "@twilio-labs/serverless-runtime-types";
import {
  Context,
  ServerlessCallback,
  ServerlessFunctionSignature,
} from "@twilio-labs/serverless-runtime-types/types";

const SYNC_SERVICE_ID = "default";
const SYNC_DOCUMENT_NAME = "status";

// TODO: Create a wrapper around fetch() that automatically
// creates and bootstraps the status document.
export const handler: ServerlessFunctionSignature = async function (
  context: Context,
  event: {},
  callback: ServerlessCallback
) {
  try {
    const client = context.getTwilioClient();
    const syncService = client.sync.services(SYNC_SERVICE_ID);
    await syncService.documents.create({
      data: {},
      uniqueName: SYNC_DOCUMENT_NAME,
    });
  } catch (error) {
    callback(String(error));
    return;
  }

  callback(null, "Initialized!");
};
