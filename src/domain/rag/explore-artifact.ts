import type { RelatedTerm } from "./related-terms";

export const EXPLORE_ARTIFACT_KIND = "related_terms" as const;

export type ExploreArtifact = {
  kind: typeof EXPLORE_ARTIFACT_KIND;
  terms: RelatedTerm[];
};

export function buildExploreArtifactContent(terms: RelatedTerm[]): string {
  const artifact: ExploreArtifact = {
    kind: EXPLORE_ARTIFACT_KIND,
    terms,
  };
  return JSON.stringify(artifact);
}
