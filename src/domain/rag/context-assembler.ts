export type RetrievedChunkMatch = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  excerpt: string;
  score: number;
  documentPipelineVersion: string;
  chunkingVersion: string;
  embeddingModel: string;
};

export type RagSource = RetrievedChunkMatch & {
  sourceNumber: number;
};

export type AssembledRagContext = {
  sources: RagSource[];
  promptContext: string;
};

export function numberSources(matches: RetrievedChunkMatch[]): RagSource[] {
  return matches.map((match, index) => ({
    ...match,
    sourceNumber: index + 1,
  }));
}

export function assembleRagContext(
  matches: RetrievedChunkMatch[],
): AssembledRagContext {
  const sources = numberSources(matches);

  return {
    sources,
    promptContext: sources.map(formatSourceBlock).join("\n\n"),
  };
}

function formatSourceBlock(source: RagSource): string {
  return [
    `[${source.sourceNumber}] Título: ${source.documentTitle}`,
    `Chunk: ${source.chunkIndex}`,
    "Trecho:",
    source.excerpt,
  ].join("\n");
}
