import { google, type drive_v3 } from "googleapis";

import type {
  DriveFileCandidate,
  DriveFileSource,
} from "@/application/ingestion/ports";
import { IngestionError } from "@/domain/documents/errors";
import { env, type ServerEnv } from "@/env/server";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_LIST_FIELDS =
  "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime)";
const DEFAULT_PAGE_SIZE = 100;

type DriveProviderFile = Pick<
  drive_v3.Schema$File,
  "id" | "name" | "mimeType" | "createdTime" | "modifiedTime"
>;

type DriveListResponse = {
  data: {
    files?: DriveProviderFile[];
    nextPageToken?: string | null;
  };
};

type DriveDownloadResponse = {
  data: ArrayBuffer | Uint8Array | Buffer | string;
};

export type GoogleDriveFilesClient = {
  files: {
    list(params: drive_v3.Params$Resource$Files$List): Promise<DriveListResponse>;
    get(
      params: drive_v3.Params$Resource$Files$Get,
      options: { responseType: "arraybuffer" },
    ): Promise<DriveDownloadResponse>;
  };
};

export type GoogleDriveFileSourceOptions = {
  drive: GoogleDriveFilesClient;
  folderId: string;
  pageSize?: number;
};

export class GoogleDriveFileSource implements DriveFileSource {
  private readonly drive: GoogleDriveFilesClient;
  private readonly folderId: string;
  private readonly pageSize: number;

  constructor(options: GoogleDriveFileSourceOptions) {
    this.drive = options.drive;
    this.folderId = options.folderId;
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  async listFiles(): Promise<DriveFileCandidate[]> {
    const files: DriveFileCandidate[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.listPage(pageToken);

      for (const file of response.data.files ?? []) {
        files.push(normalizeDriveFile(file));
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return files;
  }

  async downloadFile(driveFileId: string): Promise<Uint8Array> {
    try {
      const response = await this.drive.files.get(
        {
          fileId: driveFileId,
          alt: "media",
          supportsAllDrives: true,
        },
        { responseType: "arraybuffer" },
      );

      return toUint8Array(response.data);
    } catch {
      throw new IngestionError(
        "drive_download_failed",
        "Failed to download PDF bytes from Google Drive",
      );
    }
  }

  private async listPage(pageToken?: string): Promise<DriveListResponse> {
    try {
      return await this.drive.files.list({
        q: `${toDriveQueryLiteral(this.folderId)} in parents and trashed = false`,
        fields: DRIVE_LIST_FIELDS,
        orderBy: "createdTime,name",
        pageSize: this.pageSize,
        spaces: "drive",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        ...(pageToken ? { pageToken } : {}),
      });
    } catch {
      throw new IngestionError(
        "unknown_error",
        "Failed to list files from Google Drive",
      );
    }
  }
}

export function createGoogleDriveFileSourceFromEnv(
  serverEnv: Pick<
    ServerEnv,
    | "GOOGLE_DRIVE_FOLDER_ID"
    | "GOOGLE_SERVICE_ACCOUNT_EMAIL"
    | "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
  > = env,
): GoogleDriveFileSource {
  const auth = new google.auth.JWT({
    email: serverEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: serverEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: [DRIVE_READONLY_SCOPE],
  });
  const drive = google.drive({ version: "v3", auth });

  return new GoogleDriveFileSource({
    drive: drive as unknown as GoogleDriveFilesClient,
    folderId: serverEnv.GOOGLE_DRIVE_FOLDER_ID,
  });
}

function normalizeDriveFile(file: DriveProviderFile): DriveFileCandidate {
  if (!file.id || !file.name) {
    throw new IngestionError(
      "unknown_error",
      "Google Drive file is missing required metadata",
    );
  }

  return {
    driveFileId: file.id,
    name: file.name,
    mimeType: file.mimeType ?? null,
    createdTime: file.createdTime ?? null,
    modifiedTime: file.modifiedTime ?? null,
  };
}

function toUint8Array(data: DriveDownloadResponse["data"]): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  throw new IngestionError(
    "drive_download_failed",
    "Google Drive download returned unsupported bytes",
  );
}

function toDriveQueryLiteral(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
