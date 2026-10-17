import { formatMessage, notifyUsers } from "../shared/message";
import { createMockContext } from "./test-utils";

describe("message utility", () => {
  const baseStatus = {
    allowMultipleOpens: false,
    brandName: "Chatterbox",
    lockTime: new Date(0),
    phoneNumber: "+18889990000",
    user: "",
    users: {
      "+12223334444": "Alice",
      "+15556667777": "Bob",
    },
    guests: {
      "+19998887777": "Charlie",
    },
  };

  describe("formatMessage", () => {
    it("should prepend brandName and append opt-out instructions for subscribed users and guests", () => {
      expect(formatMessage(baseStatus, "+12223334444", "Hello!")).toBe(
        "Chatterbox: Hello! Reply STOP to opt out.",
      );
      expect(formatMessage(baseStatus, "+19998887777", "Hello!")).toBe(
        "Chatterbox: Hello! Reply STOP to opt out.",
      );
    });

    it("should not append opt-out instructions for unsubscribed numbers", () => {
      expect(formatMessage(baseStatus, "+10000000000", "Hello!")).toBe(
        "Chatterbox: Hello!",
      );
    });
  });

  describe("notifyUsers", () => {
    it("should send formatted messages to all users", async () => {
      const context = createMockContext(baseStatus);
      const client = context.getTwilioClient();

      await notifyUsers(
        context,
        baseStatus,
        (number) =>
          `Hello ${baseStatus.users[number as keyof typeof baseStatus.users]}!`,
      );

      expect(client.messages.create).toHaveBeenCalledTimes(2);
      expect(client.messages.create).toHaveBeenCalledWith({
        body: "Chatterbox: Hello Alice! Reply STOP to opt out.",
        from: "+18889990000",
        to: "+12223334444",
      });
      expect(client.messages.create).toHaveBeenCalledWith({
        body: "Chatterbox: Hello Bob! Reply STOP to opt out.",
        from: "+18889990000",
        to: "+15556667777",
      });
    });
  });
});
