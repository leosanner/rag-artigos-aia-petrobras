import { describe, expect, it, vi } from "vitest";

import type { SelectableDocumentRow } from "@/repositories/documents-repository";

import { ListRagDocuments } from "./list-rag-documents";

const DOC_RECENT = "11111111-1111-4111-8111-111111111111";
const DOC_OLDER = "22222222-2222-4222-8222-222222222222";

function buildRow(overrides: Partial<SelectableDocumentRow> = {}): SelectableDocumentRow {
  return {
    id: DOC_RECENT,
    title: "artigo-recente.pdf",
    authors: "Doe, J.",
    publicationYear: 2024,
    doi: "10.0/doc-recente",
    chunkCount: 12,
    updatedAt: new Date("2026-04-20T10:00:00.000Z"),
    ...overrides,
  };
}

describe("ListRagDocuments", () => {
  it("projects repository rows into selectable DTOs preserving repository order and ISO updatedAt", async () => {
    const rows: SelectableDocumentRow[] = [
      buildRow(),
      buildRow({
        id: DOC_OLDER,
        title: "artigo-antigo.pdf",
        authors: null,
        publicationYear: null,
        doi: null,
        chunkCount: 3,
        updatedAt: new Date("2026-03-01T08:30:00.000Z"),
      }),
    ];
    const reader = {
      listSelectableForFocusedRag: vi.fn().mockResolvedValue(rows),
    };

    const service = new ListRagDocuments({ selectableDocumentsReader: reader });

    await expect(service.execute()).resolves.toEqual({
      documents: [
        {
          id: DOC_RECENT,
          title: "artigo-recente.pdf",
          authors: "Doe, J.",
          publicationYear: 2024,
          doi: "10.0/doc-recente",
          chunkCount: 12,
          updatedAt: "2026-04-20T10:00:00.000Z",
        },
        {
          id: DOC_OLDER,
          title: "artigo-antigo.pdf",
          authors: null,
          publicationYear: null,
          doi: null,
          chunkCount: 3,
          updatedAt: "2026-03-01T08:30:00.000Z",
        },
      ],
    });
    expect(reader.listSelectableForFocusedRag).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when the repository has no selectable documents", async () => {
    const reader = {
      listSelectableForFocusedRag: vi.fn().mockResolvedValue([]),
    };
    const service = new ListRagDocuments({ selectableDocumentsReader: reader });

    await expect(service.execute()).resolves.toEqual({ documents: [] });
  });
});
