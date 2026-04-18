import { IngestionError } from "../documents/errors";

const C0_CONTROLS_EXCEPT_TAB_LF = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const C1_CONTROLS = /[\x7F-\x9F]/g;
const LINE_BREAK_HYPHEN = /(\w)-\n(\w)/g;
const HORIZONTAL_WHITESPACE = /[ \t]+/g;
const THREE_OR_MORE_NEWLINES = /\n{3,}/g;

export function refineText(rawText: string): string {
  const refined = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(C0_CONTROLS_EXCEPT_TAB_LF, "")
    .replace(C1_CONTROLS, "")
    .replace(LINE_BREAK_HYPHEN, "$1$2")
    .replace(HORIZONTAL_WHITESPACE, " ")
    .replace(THREE_OR_MORE_NEWLINES, "\n\n")
    .trim();

  if (refined.length === 0) {
    throw new IngestionError(
      "refined_text_empty",
      "refined text is empty after deterministic cleanup",
    );
  }

  return refined;
}
