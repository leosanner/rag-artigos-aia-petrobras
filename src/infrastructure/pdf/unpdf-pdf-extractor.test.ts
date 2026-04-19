import { describe, expect, it, vi } from "vitest";

import { IngestionError } from "@/domain/documents/errors";

import { UnpdfPdfExtractor } from "./unpdf-pdf-extractor";
import { extractText, getDocumentProxy } from "unpdf";

vi.mock("unpdf", () => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}));

const mockedGetDocumentProxy = vi.mocked(getDocumentProxy);
const mockedExtractText = vi.mocked(extractText);

describe("UnpdfPdfExtractor", () => {
  it("extracts merged raw text from PDF bytes", async () => {
    const pdfProxy = { id: "pdf-proxy" };
    mockedGetDocumentProxy.mockResolvedValue(pdfProxy as never);
    mockedExtractText.mockResolvedValue({
      totalPages: 1,
      text: "Raw extracted text",
    } as never);
    const extractor = new UnpdfPdfExtractor();
    const bytes = new Uint8Array([37, 80, 68, 70]);

    await expect(extractor.extract(bytes)).resolves.toBe("Raw extracted text");
    expect(mockedGetDocumentProxy).toHaveBeenCalledWith(bytes);
    expect(mockedExtractText).toHaveBeenCalledWith(pdfProxy, { mergePages: true });
  });

  it("classifies whitespace-only extraction as raw_text_empty", async () => {
    mockedGetDocumentProxy.mockResolvedValue({} as never);
    mockedExtractText.mockResolvedValue({
      totalPages: 1,
      text: " \n\t ",
    } as never);
    const extractor = new UnpdfPdfExtractor();

    await expect(extractor.extract(new Uint8Array([1]))).rejects.toMatchObject({
      code: "raw_text_empty",
    } satisfies Partial<IngestionError>);
  });

  it("classifies unpdf failures as extraction_failed without exposing provider messages", async () => {
    mockedGetDocumentProxy.mockRejectedValue(
      new Error("SECRET provider failure details"),
    );
    const extractor = new UnpdfPdfExtractor();

    await expect(extractor.extract(new Uint8Array([1]))).rejects.toMatchObject({
      code: "extraction_failed",
    } satisfies Partial<IngestionError>);
  });
});
