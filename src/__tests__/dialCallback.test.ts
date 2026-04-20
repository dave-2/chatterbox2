import { handler } from "../functions/dialCallback";
import { createMockContext, createMockCallback } from "./test-utils";

describe("dialCallback handler", () => {
  const mockStatus = {
    users: {
      "+12223334444": "Alice",
      "+15556667777": "Bob",
    },
    phoneNumber: "+18889990000",
  };

  it("should do nothing if CallStatus is not 'in-progress'", async () => {
    const context = createMockContext(mockStatus);
    const event = { CallStatus: "completed", To: "+15556667777" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(context.getTwilioClient).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(null);
  });

  it("should notify users when a call is answered", async () => {
    const context = createMockContext(mockStatus);
    const event = { CallStatus: "in-progress", To: "+15556667777" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    const client = context.getTwilioClient();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(client.messages.create).toHaveBeenCalledWith({
      body: "You answered the door. 🐕",
      from: mockStatus.phoneNumber,
      to: "+15556667777",
    });
    expect(client.messages.create).toHaveBeenCalledWith({
      body: "Bob answered the door. 🐕",
      from: mockStatus.phoneNumber,
      to: "+12223334444",
    });
    expect(callback).toHaveBeenCalledWith(null);
  });

  it("should handle errors", async () => {
    const context = createMockContext(mockStatus);
    const error = new Error("Sync failed");
    (
      context.getTwilioClient().sync.services().documents().fetch as jest.Mock
    ).mockRejectedValue(error);

    const event = { CallStatus: "in-progress", To: "+15556667777" } as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(String(error));
  });
});
