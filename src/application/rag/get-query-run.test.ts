import { describe, expect, it, vi } from "vitest";

import { GetQueryRun } from "./get-query-run";

describe("GetQueryRun", () => {
  it("loads one persisted query run detail through the repository", async () => {
    const expected = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      question: "Pergunta auditada",
      answer: "Resposta [1].",
      mode: "global" as const,
      status: "answered" as const,
      errorCode: null,
      sources: [],
      relatedTerms: [],
      metadata: {
        mode: "global" as const,
        topK: 6,
        retrievalStrategy: "standard" as const,
        candidateTopK: 6,
        promptVersion: "f05-audit-v1",
        generationModel: "gpt-4.1-mini",
        embeddingModel: "text-embedding-3-large",
      },
      audit: {
        latencyMs: 123,
        embedding: {
          inputTokens: 12,
          estimatedCostUsd: 0.00000156,
        },
        generation: null,
        totalCostUsd: 0.00000156,
      },
      createdAt: new Date("2026-04-23T10:00:00.000Z"),
    };
    const runsRepository = {
      getById: vi.fn().mockResolvedValue(expected),
    };
    const service = new GetQueryRun({
      runsRepository,
    });

    await expect(
      service.execute("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).resolves.toEqual(expected);
    expect(runsRepository.getById).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("returns null when the repository does not find the run", async () => {
    const runsRepository = {
      getById: vi.fn().mockResolvedValue(null),
    };
    const service = new GetQueryRun({
      runsRepository,
    });

    await expect(
      service.execute("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ).resolves.toBeNull();
  });
});
