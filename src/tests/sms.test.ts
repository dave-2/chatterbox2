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

  it.each(["HELP", "info"])(
    "should handle %s keyword for registered users and guests",
    async (keyword) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+19998887777", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: Text 'unlock' (or a number of minutes) to unlock the door, or 'lock' to lock it. Contact the household owner at +18889990000 for support. Reply STOP to opt out. 🛟",
      );
    },
  );

  it.each(["HELP", "info"])(
    "should handle %s keyword for unregistered numbers",
    async (keyword) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+10000000000", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: Contact the household owner for support. 🛟",
      );
    },
  );

  it.each(["START", "yes", "unstop"])(
    "should handle %s keyword for registered users and guests",
    async (keyword) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+19998887777", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: You are subscribed to intercom alerts. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out. 🟢",
      );
    },
  );

  it.each(["START", "yes", "unstop"])(
    "should handle %s keyword for unregistered numbers",
    async (keyword) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+10000000000", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: Messaging is enabled! Contact the household owner to be added to intercom alerts. 🟢",
      );
    },
  );

  it.each(["STOP", "stopall", "unsubscribe", "cancel", "end", "quit"])(
    "should allow registered user or guest to opt out with %s",
    async (keyword) => {
      const status = {
        ...mockStatus,
        users: { "+12223334444": "Alice" },
        guests: { "+19998887777": "Charlie" },
      };
      const context = createMockContext(status);
      const event = { From: "+19998887777", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: You have been unsubscribed and will receive no further messages. 🛑 Reply START and contact the household owner to resubscribe.",
      );
      expect(
        context.getTwilioClient().sync.v1.services().documents().update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guests: {},
          }),
        }),
      );
    },
  );

  it.each(["STOP", "stopall", "unsubscribe", "cancel", "end", "quit"])(
    "should handle %s keyword for unregistered numbers without updating status",
    async (keyword) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+10000000000", Body: keyword } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: You have been unsubscribed and will receive no further messages. 🛑 Reply START and contact the household owner to resubscribe.",
      );
      expect(
        context.getTwilioClient().sync.v1.services().documents().update,
      ).not.toHaveBeenCalled();
    },
  );

  it("should deny access if not a user or guest", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+10000000000", Body: "status" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: No permissions to grant access. :(",
    );
  });

  it("should allow guest to unlock", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+19998887777", Body: "unlock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: You added 5 minutes! 🐿️ The door's unlocked until 4:05 AM.",
    );
  });

  it("should handle 'unlock' command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "unlock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: You added 5 minutes! 🐿️ The door's unlocked until 4:05 AM.",
    );
  });

  it("should deny guest other commands", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+19998887777", Body: "lock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Guests can only use the 'unlock' command. 🔒",
    );
  });

  it("should allow user to unlock with minutes", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "10" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: You added 10 minutes! 🐿️ The door's unlocked until 4:10 AM.",
    );
  });

  it("should allow user to unlock with minutes and multiple opens", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "10+" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: You added 10 minutes! 🐿️ The door's unlocked until 4:10 AM.",
    );
    expect(
      context.getTwilioClient().sync.v1.services().documents().update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allowMultipleOpens: true }),
      }),
    );
  });

  it("should allow user to schedule unlock with '<minutes> at <H:MM>'", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "15 at 15:00" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Scheduled 15 minutes! 🐿️ The door will unlock from 3:00 PM to 3:15 PM.",
    );
    expect(
      context.getTwilioClient().sync.v1.services().documents().update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowMultipleOpens: false,
          unlockTime: new Date("2023-01-01T23:00:00.000Z"),
          lockTime: new Date("2023-01-01T23:15:00.000Z"),
        }),
      }),
    );
  });

  it("should roll schedules earlier than now to tomorrow", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "10+ at 2:00 AM" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Scheduled 10 minutes! 🐿️ The door will unlock from 2:00 AM to 2:10 AM.",
    );
    expect(
      context.getTwilioClient().sync.v1.services().documents().update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowMultipleOpens: true,
          unlockTime: new Date("2023-01-02T10:00:00.000Z"),
          lockTime: new Date("2023-01-02T10:10:00.000Z"),
        }),
      }),
    );
  });

  it("should deny guest from scheduling unlocks", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+19998887777", Body: "15 at 15:00" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Guests can only use the 'unlock' command. 🔒",
    );
  });

  it.each(["10 at", "10 later 15:00", "10 at 3pm", "10 at 99:99"])(
    "should return syntax error for invalid schedule command '%s'",
    async (body) => {
      const context = createMockContext(mockStatus);
      const event = { From: "+12223334444", Body: body } as any;
      const callback = createMockCallback();

      await handler(context, event, callback);

      const twiml = callback.mock.calls[0][1] as any;
      expect(twiml.message).toHaveBeenCalledWith(
        "Chatterbox: Syntax: <minutes>[+] at <H:MM [AM|PM] (Ex: 30 at 15:00 or 30+ at 3:00 PM)>",
      );
    },
  );

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
      "Chatterbox: Added guest Dave at +14155551234. 🐿️",
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
      "Chatterbox: Added Dave at +14155551234. 🦆",
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

  it("should handle 'lock' command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "lock" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      expect.stringContaining("The door's locked"),
    );
    expect(
      context.getTwilioClient().sync.v1.services().documents().update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowMultipleOpens: false,
          unlockTime: new Date(0),
        }),
      }),
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
      "Chatterbox: I don't know guest Charlie. 🐢",
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
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Removed guest Charlie. 🦆",
    );
  });

  it("should handle 'removeguest' not found", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeguest Unknown" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: I don't know guest Unknown. 🐢",
    );
  });

  it("should handle 'removeguest' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeguest" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Syntax: RemoveGuest <name>",
    );
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
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Removed Charlie. 🦆",
    );
  });

  it("should prevent self-removal", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser Alice" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Can't remove yourself, dummy! 🐓",
    );
  });

  it("should handle 'removeuser' syntax error", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Syntax: RemoveUser <name>",
    );
  });

  it("should handle 'removeuser' not found", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "removeuser Unknown" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: I don't know Unknown. 🐢",
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

  it("should handle unknown command", async () => {
    const context = createMockContext(mockStatus);
    const event = { From: "+12223334444", Body: "foobar" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1] as any;
    expect(twiml.message).toHaveBeenCalledWith(
      "Chatterbox: Could not understand. 🐼 Try giving me a number.",
    );
  });

  it("should handle errors", async () => {
    const context = createMockContext(mockStatus);
    const error = new Error("Sync failure");
    (
      context.getTwilioClient().sync.v1.services().documents()
        .fetch as jest.Mock
    ).mockRejectedValue(error);

    const event = { From: "+12223334444", Body: "status" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(String(error));
  });
});
