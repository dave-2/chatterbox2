import { handler } from "../functions/voice.protected";
import { createMockContext, createMockCallback } from "./test-utils";

describe("voice handler", () => {
  const mockStatus = {
    allowMultipleOpens: true,
    lockTime: new Date(Date.now() + 10 * 60000), // 10 minutes in the future
    phoneNumber: "+18889990000",
    user: "+12223334444",
    users: {
      "+12223334444": "Alice",
      "+15556667777": "Bob",
    },
    guests: {},
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should open the door if locked in the future (unlocked state)", async () => {
    const status = {
      ...mockStatus,
      lockTime: new Date(Date.now() + 5 * 60000).toISOString(),
    };
    const context = createMockContext(status);
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const client = context.getTwilioClient();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Door opened because Alice unlocked it"),
      }),
    );

    expect(callback).toHaveBeenCalledWith(null, expect.any(Object));
  });

  it("should handle locked state (dial users)", async () => {
    const status = {
      ...mockStatus,
      lockTime: new Date(Date.now() - 5 * 60000).toISOString(),
    };
    const context = createMockContext(status);
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(null, expect.any(Object));
    // TwiML verification would be better if we exported the classes or had better mocks
  });

  it("should lock the door after opening if allowMultipleOpens is false", async () => {
    const status = {
      ...mockStatus,
      lockTime: new Date(Date.now() + 5 * 60000).toISOString(),
      allowMultipleOpens: false,
    };
    const context = createMockContext(status);
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const client = context.getTwilioClient();
    expect(client.sync.services().documents().update).toHaveBeenCalled();
  });

  it("should handle cases where status.user is a guest", async () => {
    const status = {
      ...mockStatus,
      lockTime: new Date(Date.now() + 5 * 60000).toISOString(),
      user: "+19998887777",
      guests: { "+19998887777": "Charlie" },
    };
    const context = createMockContext(status);
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const client = context.getTwilioClient();
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "Door opened because Charlie unlocked it",
        ),
      }),
    );
  });

  it("should handle unknown sender name", async () => {
    const status = {
      ...mockStatus,
      lockTime: new Date(Date.now() + 5 * 60000).toISOString(),
      user: "+10000000000",
    };
    const context = createMockContext(status);
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const client = context.getTwilioClient();
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "Door opened because someone unlocked it",
        ),
      }),
    );
  });

  it("should handle errors", async () => {
    const context = createMockContext(mockStatus);
    const error = new Error("Boom");
    (
      context.getTwilioClient().sync.services().documents().fetch as jest.Mock
    ).mockRejectedValue(error);

    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(String(error));
  });
});
