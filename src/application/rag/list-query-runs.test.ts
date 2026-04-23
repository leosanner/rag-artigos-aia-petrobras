import { describe, expect, it, vi } from "vitest";

import { ListQueryRuns } from "./list-query-runs";

describe("ListQueryRuns", () => {
  it("lists recent query runs through the repository", async () => {
    const expected = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        question: "Pergunta recente",
        status: "answered" as const,
        topK: 6,
        retrievalStrategy: "standard" as const,
        latencyMs: 123,
        totalCostUsd: 0.000041,
        createdAt: new Date("2026-04-23T10:00:00.000Z"),
      },
    ];
    const runsRepository = {
      listRecent: vi.fn().mockResolvedValue(expected),
    };
    const service = new ListQueryRuns({
      runsRepository,
    });

    await expect(service.execute()).resolves.toEqual(expected);
    expect(runsRepository.listRecent).toHaveBeenCalledTimes(1);
  });
});
