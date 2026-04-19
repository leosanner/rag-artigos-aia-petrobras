import { extractText, getDocumentProxy } from "unpdf";

import type { PdfExtractor } from "@/application/ingestion/ports";
import { IngestionError } from "@/domain/documents/errors";

type PromiseConstructorWithTry = PromiseConstructor & {
  try?: (
    callback: (...args: unknown[]) => unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
};

function ensurePromiseTryCompatibility(): void {
  const promise = Promise as PromiseConstructorWithTry;

  if (typeof promise.try === "function") {
    return;
  }

  Object.defineProperty(promise, "try", {
    configurable: true,
    writable: true,
    value: (callback: (...args: unknown[]) => unknown, ...args: unknown[]) =>
      new Promise((resolve) => {
        resolve(callback(...args));
      }),
  });
}

export class UnpdfPdfExtractor implements PdfExtractor {
  async extract(pdfBytes: Uint8Array): Promise<string> {
    try {
      ensurePromiseTryCompatibility();
      const pdf = await getDocumentProxy(pdfBytes);
      const { text } = await extractText(pdf, { mergePages: true });

      if (text.trim().length === 0) {
        throw new IngestionError(
          "raw_text_empty",
          "PDF extraction returned empty raw text",
        );
      }

      return text;
    } catch (error) {
      if (error instanceof IngestionError) {
        throw error;
      }

      throw new IngestionError("extraction_failed", "PDF extraction failed");
    }
  }
}
