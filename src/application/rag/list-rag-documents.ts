import type { SelectableRagDocument } from "@/domain/rag";
import type { SelectableDocumentRow } from "@/repositories/documents-repository";

import type { SelectableDocumentsReader } from "./ports";

export type ListRagDocumentsDeps = {
  selectableDocumentsReader: SelectableDocumentsReader;
};

export type ListRagDocumentsResult = {
  documents: SelectableRagDocument[];
};

export class ListRagDocuments {
  private readonly selectableDocumentsReader: SelectableDocumentsReader;

  constructor(deps: ListRagDocumentsDeps) {
    this.selectableDocumentsReader = deps.selectableDocumentsReader;
  }

  async execute(): Promise<ListRagDocumentsResult> {
    const rows = await this.selectableDocumentsReader.listSelectableForFocusedRag();
    return {
      documents: rows.map(toSelectableRagDocument),
    };
  }
}

function toSelectableRagDocument(
  row: SelectableDocumentRow,
): SelectableRagDocument {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    publicationYear: row.publicationYear,
    doi: row.doi,
    chunkCount: row.chunkCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}
