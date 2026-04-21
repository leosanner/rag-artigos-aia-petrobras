import { describe, expect, it } from "vitest";

import type { RagSource } from "./context-assembler";
import {
  CitationValidationError,
  assertValidCitationMarkers,
  extractCitationNumbers,
} from "./citation-markers";

function buildSource(sourceNumber: number): RagSource {
  return {
    sourceNumber,
    chunkId: `${sourceNumber}${sourceNumber}${sourceNumber}${sourceNumber}${sourceNumber}${sourceNumber}${sourceNumber}${sourceNumber}-1111-4111-8111-111111111111`,
    documentId: "22222222-2222-4222-8222-222222222222",
    documentTitle: `Documento ${sourceNumber}`,
    chunkIndex: sourceNumber - 1,
    excerpt: `Trecho ${sourceNumber}`,
    score: 0.9 - sourceNumber / 100,
    documentPipelineVersion: "pipeline-test-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: "text-embedding-3-large",
  };
}

describe("extractCitationNumbers", () => {
  it("extracts canonical bracketed citation markers in encounter order and preserves repetitions", () => {
    const answer =
      "Os achados aparecem em [1], sao reforcados em [2] e retomados em [1], com sintese final em [10].";

    expect(extractCitationNumbers(answer)).toEqual([1, 2, 1, 10]);
  });

  it("ignores plain numbers that are not inside citation markers", () => {
    const answer =
      "O estudo avaliou 31 artigos em 2024 e concluiu que a area 1 exige monitoramento.";

    expect(extractCitationNumbers(answer)).toEqual([]);
  });
});

describe("assertValidCitationMarkers", () => {
  it("accepts valid in-range citations and allows retrieved but uncited sources", () => {
    const sources = [buildSource(1), buildSource(2), buildSource(3)];

    expect(() =>
      assertValidCitationMarkers(
        "A resposta se apoia nos resultados principais [1] e na validacao complementar [2].",
        sources,
      ),
    ).not.toThrow();
  });

  it("accepts repeated valid citations in the validator path", () => {
    const sources = [buildSource(1), buildSource(2)];

    expect(() =>
      assertValidCitationMarkers(
        "A sintese retoma o mesmo estudo em [1] e [1], com apoio complementar em [2].",
        sources,
      ),
    ).not.toThrow();
  });

  it("rejects answers with no citations when retrieved sources exist", () => {
    expect(() =>
      assertValidCitationMarkers(
        "Ha indicios de impacto, mas a resposta nao citou as fontes.",
        [buildSource(1)],
      ),
    ).toThrow(CitationValidationError);
  });

  it("rejects citations that fall outside the available source range", () => {
    expect(() =>
      assertValidCitationMarkers("A conclusao depende de [3].", [
        buildSource(1),
        buildSource(2),
      ]),
    ).toThrow(CitationValidationError);
  });

  it("rejects malformed bracket tokens even when a valid citation also exists", () => {
    const malformedAnswers = [
      "A resposta cita [1] e tambem [01].",
      "A resposta usa [0].",
      "A resposta usa [-1].",
      "A resposta usa [1.0].",
      "A resposta usa [1,2].",
      "A resposta usa [ 1 ].",
      "A resposta usa [abc].",
    ];

    for (const answer of malformedAnswers) {
      expect(() =>
        assertValidCitationMarkers(answer, [buildSource(1), buildSource(2)]),
      ).toThrow(CitationValidationError);
    }
  });

  it("rejects citations when there are no available sources", () => {
    expect(() =>
      assertValidCitationMarkers("Nao ha suporte suficiente [1].", []),
    ).toThrow(CitationValidationError);
  });

  it("allows answers without citations when there are no sources", () => {
    expect(() =>
      assertValidCitationMarkers(
        "Nao encontrei evidencias suficientes para responder com seguranca.",
        [],
      ),
    ).not.toThrow();
  });
});
