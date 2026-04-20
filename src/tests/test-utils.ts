import {
  Context,
  ServerlessCallback,
} from "@twilio-labs/serverless-runtime-types/types";

export interface MockContext extends Context {
  getTwilioClient: jest.Mock;
}

export function createMockContext(data: any = {}): MockContext {
  const documentsMock: any = jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue({ data }),
    update: jest.fn().mockResolvedValue({}),
  });
  documentsMock.create = jest.fn().mockResolvedValue({});

  const client = {
    sync: {
      v1: {
        services: jest.fn().mockReturnValue({
          documents: documentsMock,
        }),
      },
    },
    messages: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  return {
    getTwilioClient: jest.fn().mockReturnValue(client),
    ...process.env,
  } as any;
}

export function createMockCallback(): ServerlessCallback & jest.Mock {
  return jest.fn() as any;
}

// Mock global Twilio for TwiML
(global as any).Twilio = {
  twiml: {
    MessagingResponse: class {
      message = jest.fn();
      toString = jest.fn().mockReturnValue("<Response/>");
    },
    VoiceResponse: class {
      play = jest.fn();
      dial = jest.fn().mockReturnValue({
        number: jest.fn(),
      });
      toString = jest.fn().mockReturnValue("<Response/>");
    },
  },
};
