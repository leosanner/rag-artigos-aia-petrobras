import { describe, expect, it } from "vitest";

import { documentStatus } from "@/db/schema";

describe("project setup", () => {
  it("defines the document status contract", () => {
    expect(documentStatus.enumValues).toEqual([
      "pending",
      "processed",
      "failed",
    ]);
  });
});
