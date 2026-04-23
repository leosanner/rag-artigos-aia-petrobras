import { describe, expect, it } from "vitest";

import { extractRelatedTerms } from "./related-terms";

describe("extractRelatedTerms", () => {
  it("uses the question-only fallback, preserves domain acronyms, and removes PT/EN stopwords", () => {
    const result = extractRelatedTerms({
      question: "ML and EIA com GIS e ML",
      sourceExcerpts: [],
    });

    expect(result).toEqual(extractRelatedTerms({
      question: "ML and EIA com GIS e ML",
      sourceExcerpts: [],
    }));
    expect(result[0]).toEqual({
      rank: 1,
      term: "ml",
      ngramSize: 1,
      frequency: 2,
      sourceCoverageCount: 0,
    });
    expect(result.every((term) => term.sourceCoverageCount === 0)).toBe(true);
    expect(result.some((term) => term.term.includes("eia"))).toBe(true);
    expect(result.some((term) => term.term.includes("gis"))).toBe(true);
    expect(result.map((term) => term.term)).not.toContain("and");
    expect(result.map((term) => term.term)).not.toContain("com");
    expect(result.map((term) => term.term)).not.toContain("e");
  });

  it("aggregates frequency across question and sources while counting coverage only from distinct source excerpts", () => {
    const result = extractRelatedTerms({
      question: "machine learning",
      sourceExcerpts: ["machine learning EIA", "machine learning GIS"],
    });

    expect(result[0]).toEqual({
      rank: 1,
      term: "machine learning",
      ngramSize: 2,
      frequency: 3,
      sourceCoverageCount: 2,
    });
  });

  it("keeps the same output when source order changes and breaks variant ties lexicographically", () => {
    const original = extractRelatedTerms({
      question: "",
      sourceExcerpts: ["Avaliacao ambiental", "avaliação ambiental"],
    });
    const reversed = extractRelatedTerms({
      question: "",
      sourceExcerpts: ["avaliação ambiental", "Avaliacao ambiental"],
    });

    expect(original).toEqual(reversed);
    expect(original[0]).toEqual({
      rank: 1,
      term: "avaliacao ambiental",
      ngramSize: 2,
      frequency: 2,
      sourceCoverageCount: 2,
    });
  });

  it("ranks higher source coverage ahead of higher total frequency", () => {
    const result = extractRelatedTerms({
      question: "",
      sourceExcerpts: ["alpha", "alpha", "beta beta beta"],
    });

    expect(result[0]?.term).toBe("alpha");
    expect(result[1]?.term).toBe("beta");
  });

  it("breaks same-stat ties alphabetically for terms with the same ngram size", () => {
    const result = extractRelatedTerms({
      question: "",
      sourceExcerpts: ["uav", "sar"],
    });

    expect(result).toEqual([
      {
        rank: 1,
        term: "sar",
        ngramSize: 1,
        frequency: 1,
        sourceCoverageCount: 1,
      },
      {
        rank: 2,
        term: "uav",
        ngramSize: 1,
        frequency: 1,
        sourceCoverageCount: 1,
      },
    ]);
  });

  it("suppresses redundant subterms when a larger phrase has the same coverage and frequency", () => {
    const result = extractRelatedTerms({
      question: "",
      sourceExcerpts: ["machine learning", "machine learning"],
    });

    expect(result.map((term) => term.term)).toContain("machine learning");
    expect(result.map((term) => term.term)).not.toContain("machine");
    expect(result.map((term) => term.term)).not.toContain("learning");
  });

  it("caps the final result at eight ranked terms with sequential ranks", () => {
    const result = extractRelatedTerms({
      question: "",
      sourceExcerpts: [
        "zeta",
        "eta",
        "theta",
        "iota",
        "kappa",
        "lambda",
        "mu",
        "nu",
        "omicron",
        "pi",
      ],
    });

    expect(result).toHaveLength(8);
    expect(result.map((term) => term.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.map((term) => term.term)).toEqual([
      "eta",
      "iota",
      "kappa",
      "lambda",
      "mu",
      "nu",
      "omicron",
      "pi",
    ]);
  });
});
