import { describe, expect, it } from "vitest";

import {
  assembleRagContext,
  numberSources,
  type RetrievedChunkMatch,
} from "./context-assembler";

function buildMatch(
  overrides: Partial<RetrievedChunkMatch> = {},
): RetrievedChunkMatch {
  return {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
    documentTitle: "Artigo sobre sensoriamento remoto",
    chunkIndex: 3,
    excerpt: "Trecho com evidencias observadas por satelite.",
    score: 0.92,
    documentPipelineVersion: "pipeline-test-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
    ...overrides,
  };
}

describe("numberSources", () => {
  it("assigns source numbers starting at 1 while preserving retrieval order", () => {
    const matches: RetrievedChunkMatch[] = [
      buildMatch({
        chunkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        chunkIndex: 0,
        documentTitle: "Documento A",
      }),
      buildMatch({
        chunkId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        chunkIndex: 5,
        documentTitle: "Documento B",
      }),
      buildMatch({
        chunkId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        chunkIndex: 2,
        documentTitle: "Documento C",
      }),
    ];

    const sources = numberSources(matches);

    expect(sources.map((source) => source.sourceNumber)).toEqual([1, 2, 3]);
    expect(sources.map((source) => source.chunkId)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
  });

  it("returns new objects without mutating the retrieved matches", () => {
    const matches = [buildMatch()];
    const snapshot = structuredClone(matches);

    const sources = numberSources(matches);

    expect(matches).toEqual(snapshot);
    expect(sources[0]).not.toBe(matches[0]);
    expect(matches[0]).not.toHaveProperty("sourceNumber");
  });
});

describe("assembleRagContext", () => {
  it("returns numbered sources and a prompt context that preserves the same numbering", () => {
    const matches: RetrievedChunkMatch[] = [
      buildMatch({
        chunkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        documentTitle: "Documento A",
        chunkIndex: 1,
        excerpt: "Primeiro trecho com achados ambientais.",
      }),
      buildMatch({
        chunkId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        documentTitle: "Documento B",
        chunkIndex: 4,
        excerpt: "Segundo trecho com resultados de validacao.",
      }),
    ];

    const assembled = assembleRagContext(matches);

    expect(assembled.sources.map((source) => source.sourceNumber)).toEqual([
      1, 2,
    ]);
    expect(assembled.promptContext).toBe(
      [
        "[1] Título: Documento A",
        "Chunk: 1",
        "Trecho:",
        "Primeiro trecho com achados ambientais.",
        "",
        "[2] Título: Documento B",
        "Chunk: 4",
        "Trecho:",
        "Segundo trecho com resultados de validacao.",
      ].join("\n"),
    );
  });

  it("is deterministic for identical input", () => {
    const matches: RetrievedChunkMatch[] = [
      buildMatch({
        documentTitle: "Documento A",
        chunkIndex: 1,
        excerpt: "Primeiro trecho.",
      }),
      buildMatch({
        chunkId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        documentTitle: "Documento B",
        chunkIndex: 2,
        excerpt: "Segundo trecho.",
      }),
    ];

    const first = assembleRagContext(matches);
    const second = assembleRagContext(matches);

    expect(first).toEqual(second);
  });

  it("returns an empty prompt context when there are no matches", () => {
    expect(assembleRagContext([])).toEqual({
      sources: [],
      promptContext: "",
    });
  });
});
