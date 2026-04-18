import { describe, expect, it } from "vitest";

import { IngestionError } from "../documents/errors";
import { refineText } from "./deterministic-refiner";

describe("refineText - whitespace", () => {
  it("collapses runs of spaces into a single space", () => {
    expect(refineText("hello    world")).toBe("hello world");
  });

  it("collapses runs of tabs into a single space", () => {
    expect(refineText("hello\t\t\tworld")).toBe("hello world");
  });

  it("collapses mixed spaces and tabs into a single space", () => {
    expect(refineText("hello \t \t world")).toBe("hello world");
  });

  it("preserves single spaces untouched", () => {
    expect(refineText("hello world")).toBe("hello world");
  });
});

describe("refineText - line endings", () => {
  it("normalizes CRLF to LF", () => {
    expect(refineText("a\r\nb")).toBe("a\nb");
  });

  it("normalizes lone CR to LF", () => {
    expect(refineText("a\rb")).toBe("a\nb");
  });

  it("collapses three or more consecutive line breaks into exactly two", () => {
    expect(refineText("para1\n\n\n\n\npara2")).toBe("para1\n\npara2");
  });

  it("preserves exactly two consecutive line breaks (paragraph boundary)", () => {
    expect(refineText("para1\n\npara2")).toBe("para1\n\npara2");
  });

  it("preserves a single line break inside a paragraph", () => {
    expect(refineText("line1\nline2")).toBe("line1\nline2");
  });
});

describe("refineText - dehyphenation", () => {
  it("joins words hyphenated across a line break", () => {
    expect(refineText("photo-\nsynthesis")).toBe("photosynthesis");
  });

  it("joins several hyphenated splits in one pass", () => {
    expect(refineText("micro-\norganism and macro-\nphage")).toBe(
      "microorganism and macrophage",
    );
  });

  it("does not merge when the hyphen is not followed by a line break", () => {
    expect(refineText("well-known")).toBe("well-known");
  });

  it("does not merge when one side is not a word character", () => {
    expect(refineText("dash -\nnextline")).toBe("dash -\nnextline");
  });
});

describe("refineText - control characters", () => {
  it("strips C0 controls but preserves \\n and \\t", () => {
    const input = "a\x00b\x07c\x1Fd\ne\tf";

    expect(refineText(input)).toBe("abcd\ne f");
  });

  it("strips C1 controls", () => {
    expect(refineText("a\x7Fb\x9Fc")).toBe("abc");
  });
});

describe("refineText - sanity", () => {
  it("leaves clean text untouched", () => {
    const clean = "This is a clean paragraph.\n\nThis is another one.";

    expect(refineText(clean)).toBe(clean);
  });

  it("trims leading and trailing whitespace", () => {
    expect(refineText("   hello world   ")).toBe("hello world");
  });

  it("does not invent characters outside the input alphabet", () => {
    const input = "alpha beta\ngamma";
    const output = refineText(input);
    const inputChars = new Set(input);

    for (const ch of output) {
      expect(inputChars.has(ch)).toBe(true);
    }
  });
});

describe("refineText - empty results", () => {
  it("throws IngestionError('refined_text_empty') on an empty string", () => {
    expect(() => refineText("")).toThrow(IngestionError);
    try {
      refineText("");
      expect.unreachable();
    } catch (err) {
      expect((err as IngestionError).code).toBe("refined_text_empty");
    }
  });

  it("throws IngestionError('refined_text_empty') on whitespace-only input", () => {
    for (const input of ["   ", "\n\n\n", "\t\t", "  \n\t  "]) {
      expect(() => refineText(input)).toThrow(IngestionError);
    }
  });

  it("throws IngestionError('refined_text_empty') on control-only input", () => {
    expect(() => refineText("\x00\x01\x1F\x7F")).toThrow(IngestionError);
  });
});
