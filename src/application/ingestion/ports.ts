export type DriveFileCandidate = {
  driveFileId: string;
  name: string;
  mimeType: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
};

export interface DriveFileSource {
  listFiles(): Promise<DriveFileCandidate[]>;
  downloadFile(driveFileId: string): Promise<Uint8Array>;
}

export interface PdfExtractor {
  extract(pdfBytes: Uint8Array): Promise<string>;
}

export interface IngestionEventPublisher {
  publishSyncRequested(runId: string): Promise<void>;
}

export type ProcessIngestionRunHandler = {
  execute(runId: string): Promise<void>;
};
