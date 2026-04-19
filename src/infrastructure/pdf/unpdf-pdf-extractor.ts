import { extractText, getDocumentProxy } from "unpdf";

import type { PdfExtractor } from "@/application/ingestion/ports";
import { IngestionError } from "@/domain/documents/errors";

export class UnpdfPdfExtractor implements PdfExtractor {
  async extract(pdfBytes: Uint8Array): Promise<string> {
    try {
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
