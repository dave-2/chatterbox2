import { Context } from "@twilio-labs/serverless-runtime-types/types";

export type Status = {
  allowMultipleOpens: boolean;
  lockTime: Date;
  phoneNumber: string;
  user: string;
  users: { [number: string]: string };
  guests: { [number: string]: string };
};

const SYNC_SERVICE_ID = "default";
const SYNC_DOCUMENT_NAME = "status";
const DEFAULT_STATUS: Status = {
  allowMultipleOpens: false,
  lockTime: new Date(0),
  phoneNumber: "",
  user: "",
  users: {},
  guests: {},
};

export async function getStatus(context: Context): Promise<Status> {
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  try {
    const document = await syncService.documents(SYNC_DOCUMENT_NAME).fetch();
    return { ...DEFAULT_STATUS, ...document.data };
  } catch (error: any) {
    if (error.status === 404) {
      await syncService.documents.create({
        data: DEFAULT_STATUS,
        uniqueName: SYNC_DOCUMENT_NAME,
      });
      return DEFAULT_STATUS;
    }
    throw error;
  }
}

export async function updateStatus(
  context: Context,
  status: Status,
  newStatus: Partial<Status>,
): Promise<void> {
  const data = { ...status, ...newStatus };
  const syncService = context.getTwilioClient().sync.services(SYNC_SERVICE_ID);
  try {
    await syncService.documents(SYNC_DOCUMENT_NAME).update({ data });
  } catch (error: any) {
    if (error.status === 404) {
      await syncService.documents.create({
        data,
        uniqueName: SYNC_DOCUMENT_NAME,
      });
      return;
    }
    throw error;
  }
}
