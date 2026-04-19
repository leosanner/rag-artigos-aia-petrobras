export type IngestionErrorCode =
  | "drive_listing_failed"
  | "drive_download_failed"
  | "raw_text_empty"
  | "extraction_failed"
  | "refined_text_empty"
  | "refinement_failed"
  | "unknown_error";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;

  constructor(code: IngestionErrorCode, message: string) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
  }
}

export function toSafeErrorCode(err: unknown): IngestionErrorCode {
  if (err instanceof IngestionError) {
    return err.code;
  }
  return "unknown_error";
}
