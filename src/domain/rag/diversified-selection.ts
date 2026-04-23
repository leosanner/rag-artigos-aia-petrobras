import type { RetrievedChunkMatch } from "./context-assembler";

const MAX_MATCHES_PER_DOCUMENT_WHILE_DIVERSIFYING = 2;

export function selectDiversifiedMatches(input: {
  matches: RetrievedChunkMatch[];
  topK: number;
}): RetrievedChunkMatch[] {
  const { matches, topK } = input;

  if (topK <= 0) {
    return [];
  }

  if (matches.length <= topK) {
    return [...matches];
  }

  const selected: RetrievedChunkMatch[] = [];
  const skippedForBackfill: RetrievedChunkMatch[] = [];
  const selectedByDocument = new Map<string, number>();

  for (const match of matches) {
    if (selected.length >= topK) {
      break;
    }

    const documentSelectionCount =
      selectedByDocument.get(match.documentId) ?? 0;

    if (
      documentSelectionCount >= MAX_MATCHES_PER_DOCUMENT_WHILE_DIVERSIFYING
    ) {
      skippedForBackfill.push(match);
      continue;
    }

    selected.push(match);
    selectedByDocument.set(match.documentId, documentSelectionCount + 1);
  }

  if (selected.length >= topK) {
    return selected;
  }

  return selected.concat(skippedForBackfill.slice(0, topK - selected.length));
}
