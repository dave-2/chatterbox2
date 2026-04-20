import { handler } from "../functions/init";
import { createMockContext, createMockCallback } from "./test-utils";

describe("init handler", () => {
  it("should initialize the status document successfully", async () => {
    const context = createMockContext();
    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(context.getTwilioClient).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(null, "Initialized!");
  });

  it("should handle errors during initialization", async () => {
    const context = createMockContext();
    const error = new Error("Failed to create document");
    (
      context.getTwilioClient().sync.services().documents.create as jest.Mock
    ).mockRejectedValue(error);

    const event = {} as any;
    const callback = createMockCallback();

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledWith(String(error));
  });
});
