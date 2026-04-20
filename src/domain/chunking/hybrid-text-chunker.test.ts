import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHUNKING_CONFIG,
  HybridTextChunker,
  estimateTokens,
} from "./hybrid-text-chunker";

function words(count: number, prefix = "word"): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(
    " ",
  );
}

describe("estimateTokens", () => {
  it("uses a deterministic local heuristic over words, numbers, and symbols", () => {
    expect(estimateTokens("Area 31: ML/DL + sensoriamento remoto.")).toBe(9);
    expect(estimateTokens("AIA-31 (v2) = 98%")).toBe(9);
    expect(estimateTokens("Area 31: ML/DL + sensoriamento remoto.")).toBe(9);
  });
});

describe("HybridTextChunker", () => {
  it("creates stable non-empty chunks with deterministic indexes", () => {
    const text = [
      "Primeiro paragrafo com evidencia ambiental.",
      "Segundo paragrafo com sensoriamento remoto.",
      "Terceiro paragrafo com aprendizado profundo.",
    ].join("\n\n");
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 8,
      overlapEstimatedTokens: 4,
    });

    const first = chunker.chunk({ refinedText: text });
    const second = chunker.chunk({ refinedText: text });

    expect(first).toEqual(second);
    expect(first.map((chunk) => chunk.chunkIndex)).toEqual([0, 1, 2]);
    expect(first.every((chunk) => chunk.content.trim().length > 0)).toBe(true);
    expect(first.every((chunk) => chunk.estimatedTokens <= 8)).toBe(true);
    expect(first.every((chunk, index) => chunk.chunkIndex === index)).toBe(true);
  });

  it("normalizes whitespace without dropping punctuation", () => {
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 30,
      overlapEstimatedTokens: 0,
    });

    const chunks = chunker.chunk({
      refinedText:
        "  Metodo\t\tA preserva: 31% dos sinais.\n\n\nResultado\tfinal (v2) = robusto.  ",
    });

    expect(chunks).toEqual([
      {
        chunkIndex: 0,
        content:
          "Metodo A preserva: 31% dos sinais.\n\nResultado final (v2) = robusto.",
        estimatedTokens: 15,
      },
    ]);
  });

  it("preserves paragraph boundaries when paragraphs fit within the token limit", () => {
    const text = [
      "Paragrafo A contem dados de satelite.",
      "Paragrafo B contem validacao de campo.",
    ].join("\n\n");
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 20,
      overlapEstimatedTokens: 0,
    });

    const chunks = chunker.chunk({ refinedText: text });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(text);
  });

  it("adds deterministic overlap between adjacent chunks", () => {
    const text = [words(7, "a"), words(7, "b"), words(7, "c")].join("\n\n");
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 10,
      overlapEstimatedTokens: 3,
    });

    const chunks = chunker.chunk({ refinedText: text });

    expect(chunks).toHaveLength(3);
    expect(chunks[1]?.content.startsWith("a4 a5 a6")).toBe(true);
    expect(chunks[2]?.content.startsWith("b4 b5 b6")).toBe(true);
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 10)).toBe(true);
  });

  it("reduces overlap when the next paragraph needs more room", () => {
    const text = [words(9, "a"), words(9, "b")].join("\n\n");
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 10,
      overlapEstimatedTokens: 5,
    });

    const chunks = chunker.chunk({ refinedText: text });

    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.content).toBe(`a8\n\n${words(9, "b")}`);
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 10)).toBe(true);
  });

  it("splits a single long paragraph without exceeding the max token estimate", () => {
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 10,
      overlapEstimatedTokens: 2,
    });

    const chunks = chunker.chunk({ refinedText: words(25) });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 10)).toBe(true);
    expect(chunks[1]?.content.startsWith("word8 word9")).toBe(true);
  });

  it("preserves punctuation when splitting a long paragraph", () => {
    const chunker = new HybridTextChunker({
      ...DEFAULT_CHUNKING_CONFIG,
      maxEstimatedTokens: 6,
      overlapEstimatedTokens: 2,
    });

    const chunks = chunker.chunk({
      refinedText:
        "Alpha, beta; gamma: delta. Epsilon (zeta) = eta + theta / iota.",
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.content).join(" ")).toContain("Alpha,");
    expect(chunks.map((chunk) => chunk.content).join(" ")).toContain("delta.");
    expect(chunks.map((chunk) => chunk.content).join(" ")).toContain("iota.");
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 6)).toBe(true);
  });

  it("rejects blank refined_text instead of creating empty chunks", () => {
    const chunker = new HybridTextChunker();

    expect(() => chunker.chunk({ refinedText: " \n\t " })).toThrow(
      /refined_text/i,
    );
  });
});
