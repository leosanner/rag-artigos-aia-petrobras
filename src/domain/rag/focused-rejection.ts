export const FOCUSED_DOCUMENT_REJECTION_REASONS = [
  "not_found",
  "not_processed",
  "not_indexed",
] as const;

export type FocusedDocumentRejectionReason =
  (typeof FOCUSED_DOCUMENT_REJECTION_REASONS)[number];
