import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { Sha256FileHasher } from "./sha256-file-hasher";

const HEX_PATTERN = /^[0-9a-f]{64}$/;

describe("Sha256FileHasher", () => {
  it("returns the SHA-256 of an empty buffer as lowercase hex", () => {
    const hasher = new Sha256FileHasher();

    const digest = hasher.hash(new Uint8Array());

    expect(digest).toMatch(HEX_PATTERN);
    expect(digest).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("returns a known vector for an ASCII string payload", () => {
    const hasher = new Sha256FileHasher();
    const bytes = new TextEncoder().encode("abc");

    const digest = hasher.hash(bytes);

    expect(digest).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches node:crypto for a 1 KiB random buffer", () => {
    const hasher = new Sha256FileHasher();
    const bytes = new Uint8Array(1024);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251;
    }

    const digest = hasher.hash(bytes);
    const expected = createHash("sha256").update(bytes).digest("hex");

    expect(digest).toMatch(HEX_PATTERN);
    expect(digest).toBe(expected);
  });
});
