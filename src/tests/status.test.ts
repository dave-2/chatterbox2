import { getStatus, updateStatus } from "../shared/status";
import { createMockContext } from "./test-utils";

describe("status utility", () => {
  describe("getStatus", () => {
    it("should return default status and create the document if it is missing", async () => {
      const error = new Error("Not Found") as any;
      error.status = 404;

      const context = createMockContext(null);
      const client = context.getTwilioClient();
      client.sync.v1.services().documents().fetch.mockRejectedValueOnce(error);

      const status = await getStatus(context);

      expect(status.users).toEqual({});
      expect(client.sync.v1.services().documents.create).toHaveBeenCalled();
    });

    it("should get status merged with document data", async () => {
      const data = { users: { "+12223334444": "Alice" } };
      const context = createMockContext(data);
      const status = await getStatus(context);

      expect(status.users).toEqual(data.users);
      expect(status.allowMultipleOpens).toBe(false); // default
    });

    it("should throw non-404 errors", async () => {
      const error = new Error("Boom");
      const context = createMockContext();
      const client = context.getTwilioClient();
      client.sync.v1.services().documents().fetch.mockRejectedValueOnce(error);

      await expect(getStatus(context)).rejects.toThrow("Boom");
    });
  });

  describe("updateStatus", () => {
    it("should update status", async () => {
      const context = createMockContext({ old: "data" });
      const status = await getStatus(context);
      await updateStatus(context, status, { users: { "+19998887777": "Bob" } });

      const client = context.getTwilioClient();
      expect(client.sync.v1.services().documents().update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            users: { "+19998887777": "Bob" },
          }),
        }),
      );
    });

    it("should create the document if it is missing", async () => {
      const error = new Error("Not Found") as any;
      error.status = 404;

      const context = createMockContext({ old: "data" });
      const client = context.getTwilioClient();
      client.sync.v1.services().documents().update.mockRejectedValueOnce(error);

      await updateStatus(context, {} as any, {
        users: { "+19998887777": "Bob" },
      });

      expect(client.sync.v1.services().documents.create).toHaveBeenCalled();
    });

    it("should throw non-404 errors", async () => {
      const error = new Error("Boom");
      const context = createMockContext();
      const client = context.getTwilioClient();
      client.sync.v1.services().documents().update.mockRejectedValueOnce(error);

      await expect(updateStatus(context, {} as any, {})).rejects.toThrow(
        "Boom",
      );
    });
  });
});
