import { handler } from "../functions/sms.protected";
import { createMockContext, createMockCallback } from "./test-utils";

describe("sms handler", () => {
  const mockStatus = {
    users: {
      "+12223334444": "Alice",
    },
    guests: {
      "+19998887777": "Charlie",
    },
    phoneNumber: "+18889990000",
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should deny access if not a user or guest", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+10000000000", Body: "status" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "No permissions to grant access. :(",
    );
  });

  it("should allow guest to unlock", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+19998887777", Body: "unlock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("You added 5 minutes!"),
    );
  });

  it("should deny guest other commands", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+19998887777", Body: "lock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Guests can only use the 'unlock' command. 🔒",
    );
  });

  it("should allow user to unlock with minutes", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "10" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("You added 10 minutes!"),
    );
  });

  it("should allow user to unlock with minutes and multiple opens", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "10+" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("You added 10 minutes!"),
    );
    expect(
      context.getTwilioClient().sync.services().documents().update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allowMultipleOpens: true }),
      }),
    );
  });

  it("should handle 'status' command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "status" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining('users: {"+12223334444":"Alice"}'),
    );
  });

  it("should handle 'lock' command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "lock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("The door's locked"),
    );
  });

  it("should handle 'addguest' command", async () => {
    const context = createMockContext(mockStatus);
    const event = {
      From: "+12223334444",
      Body: "addguest Dave +14155551234",
    } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Added guest Dave at +14155551234. 🐿",
    );
  });

  it("should handle 'addguest' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "addguest Dave" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("Syntax: AddGuest"),
    );
  });

  it("should handle 'adduser' command", async () => {
    const context = createMockContext(mockStatus);
    const event = {
      From: "+12223334444",
      Body: "adduser Dave +14155551234",
    } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Added Dave at +14155551234. 🦆",
    );
  });

  it("should handle 'adduser' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "adduser Dave" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("Syntax: AddUser"),
    );
  });

  it("should handle 'removeguest' when no guests exist", async () => {
    const status = { ...mockStatus, guests: {} };
    const context = createMockContext(status);
    const event = { From: "+12223334444", Body: "removeguest Charlie" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "I don't know guest Charlie. 🐢",
    );
  });

  it("should handle 'removeguest' with multiple guests", async () => {
    const status = {
      ...mockStatus,
      guests: {
        "+10000000001": "Bob",
        "+19998887777": "Charlie",
      },
    };
    const context = createMockContext(status);
    const event = { From: "+12223334444", Body: "removeguest Charlie" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith("Removed guest Charlie. 🦆");
  });

  it("should handle 'removeguest' not found", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeguest Unknown" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "I don't know guest Unknown. 🐢",
    );
  });

  it("should handle 'removeguest' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeguest" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith("Syntax: RemoveGuest <name>");
  });

  it("should handle 'removeuser' with multiple users", async () => {
    const status = {
      ...mockStatus,
      users: {
        "+12223334444": "Alice",
        "+10000000002": "Bob",
        "+10000000003": "Charlie",
      },
    };
    const context = createMockContext(status);
    const event = { From: "+12223334444", Body: "removeuser Charlie" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith("Removed Charlie. 🦆");
  });

  it("should prevent self-removal", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser Alice" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Can't remove yourself, dummy! 🐓",
    );
  });

  it("should handle 'removeuser' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith("Syntax: RemoveUser <name>");
  });

  it("should handle 'removeuser' not found", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser Unknown" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith("I don't know Unknown. 🐢");
  });

  it("should handle 'unlock' command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "unlock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("You added 5 minutes!"),
    );
  });

  it("should handle unknown command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "foobar" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Could not understand. 🐼 Try giving me a number.",
    );
  });

  it("should handle errors", async () => {
    const context = createMockContext(mockStatus);
    const error = new Error("Sync failure");
    (
      context.getTwilioClient().sync.services().documents().fetch as jest.Mock
    ).mockRejectedValue(error);

    const event = { From: "+12223334444", Body: "status" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(String(error));
  });
});
