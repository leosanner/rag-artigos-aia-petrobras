import { describe, expect, it } from "vitest";

import {
  EXPLORE_ARTIFACT_KIND,
  buildExploreArtifactContent,
} from "./explore-artifact";
import type { RelatedTerm } from "./related-terms";

describe("buildExploreArtifactContent", () => {
  it("serializes related terms into a kind-tagged JSON envelope", () => {
    const terms: RelatedTerm[] = [
      {
        rank: 1,
        term: "classificacao supervisionada",
        ngramSize: 2,
        frequency: 4,
        sourceCoverageCount: 3,
      },
      {
        rank: 2,
        term: "sensoriamento remoto",
        ngramSize: 2,
        frequency: 2,
        sourceCoverageCount: 1,
      },
    ];

    const content = buildExploreArtifactContent(terms);
    const parsed = JSON.parse(content) as unknown;

    expect(parsed).toEqual({
      kind: EXPLORE_ARTIFACT_KIND,
      terms,
    });
  });

  it("produces a non-empty string even when no terms are derived", () => {
    const content = buildExploreArtifactContent([]);
    expect(content.length).toBeGreaterThan(0);
    expect(JSON.parse(content)).toEqual({
      kind: EXPLORE_ARTIFACT_KIND,
      terms: [],
    });
  });

  it("is deterministic for equal inputs", () => {
    const terms: RelatedTerm[] = [
      {
        rank: 1,
        term: "alpha",
        ngramSize: 1,
        frequency: 1,
        sourceCoverageCount: 1,
      },
    ];
    expect(buildExploreArtifactContent(terms)).toBe(
      buildExploreArtifactContent(terms),
    );
  });
});
