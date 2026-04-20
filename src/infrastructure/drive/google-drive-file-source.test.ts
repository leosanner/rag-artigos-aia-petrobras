import { describe, expect, it, vi } from "vitest";

import { IngestionError } from "@/domain/documents/errors";

import { GoogleDriveFileSource } from "./google-drive-file-source";

function createDriveClient() {
  return {
    files: {
      list: vi.fn(),
      get: vi.fn(),
    },
  };
}

describe("GoogleDriveFileSource", () => {
  it("lists files from the configured folder with minimal fields and shared-drive options", async () => {
    const drive = createDriveClient();
    drive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: "drive-file-1",
            name: "Article.pdf",
            mimeType: "application/pdf",
            createdTime: "2026-01-01T00:00:00.000Z",
            modifiedTime: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    });
    const source = new GoogleDriveFileSource({
      drive,
      folderId: "folder-1",
    });

    const files = await source.listFiles();

    expect(drive.files.list).toHaveBeenCalledWith({
      q: "'folder-1' in parents and trashed = false",
      fields: "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime)",
      orderBy: "createdTime,name",
      pageSize: 100,
      spaces: "drive",
      corpora: "allDrives",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    expect(files).toEqual([
      {
        driveFileId: "drive-file-1",
        name: "Article.pdf",
        mimeType: "application/pdf",
        createdTime: "2026-01-01T00:00:00.000Z",
        modifiedTime: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("normalizes missing optional Drive metadata to null", async () => {
    const drive = createDriveClient();
    drive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: "drive-file-1",
            name: "Article.pdf",
          },
        ],
      },
    });
    const source = new GoogleDriveFileSource({ drive, folderId: "folder-1" });

    await expect(source.listFiles()).resolves.toEqual([
      {
        driveFileId: "drive-file-1",
        name: "Article.pdf",
        mimeType: null,
        createdTime: null,
        modifiedTime: null,
      },
    ]);
  });

  it("fetches all Drive listing pages in order", async () => {
    const drive = createDriveClient();
    drive.files.list
      .mockResolvedValueOnce({
        data: {
          nextPageToken: "page-2",
          files: [{ id: "drive-file-1", name: "First.pdf" }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [{ id: "drive-file-2", name: "Second.pdf" }],
        },
      });
    const source = new GoogleDriveFileSource({ drive, folderId: "folder-1" });

    const files = await source.listFiles();

    expect(drive.files.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageToken: "page-2" }),
    );
    expect(files.map((file) => file.driveFileId)).toEqual([
      "drive-file-1",
      "drive-file-2",
    ]);
  });

  it("converts incomplete provider rows into a safe ingestion error", async () => {
    const drive = createDriveClient();
    drive.files.list.mockResolvedValue({
      data: {
        files: [{ id: "drive-file-1" }],
      },
    });
    const source = new GoogleDriveFileSource({ drive, folderId: "folder-1" });

    await expect(source.listFiles()).rejects.toMatchObject({
      code: "unknown_error",
    } satisfies Partial<IngestionError>);
  });

  it("downloads PDF bytes through Drive files.get alt=media", async () => {
    const drive = createDriveClient();
    drive.files.get.mockResolvedValue({
      data: new Uint8Array([37, 80, 68, 70]).buffer,
    });
    const source = new GoogleDriveFileSource({ drive, folderId: "folder-1" });

    const bytes = await source.downloadFile("drive-file-1");

    expect(drive.files.get).toHaveBeenCalledWith(
      {
        fileId: "drive-file-1",
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" },
    );
    expect(bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it("converts Drive download failures into drive_download_failed", async () => {
    const drive = createDriveClient();
    drive.files.get.mockRejectedValue(new Error("private provider details"));
    const source = new GoogleDriveFileSource({ drive, folderId: "folder-1" });

    await expect(source.downloadFile("drive-file-1")).rejects.toMatchObject({
      code: "drive_download_failed",
    } satisfies Partial<IngestionError>);
  });
});
