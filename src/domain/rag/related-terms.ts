const DEFAULT_RELATED_TERMS_LIMIT = 8;
const MAX_RELATED_TERMS_LIMIT = 8;
const MAX_NGRAM_SIZE = 3;

const ALPHANUMERIC_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const DIACRITIC_PATTERN = /\p{M}+/gu;
const WHITESPACE_PATTERN = /\s+/g;
const NUMERIC_TOKEN_PATTERN = /^\p{N}+$/u;

const DOMAIN_ACRONYM_ALLOWLIST = new Set([
  "ml",
  "dl",
  "ai",
  "eia",
  "gis",
  "cnn",
  "rnn",
  "sar",
  "uav",
  "ndvi",
]);

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "ao",
  "aos",
  "are",
  "as",
  "at",
  "ate",
  "até",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "by",
  "com",
  "como",
  "da",
  "das",
  "de",
  "del",
  "dela",
  "dele",
  "deles",
  "depois",
  "do",
  "does",
  "doing",
  "dos",
  "during",
  "e",
  "ela",
  "elas",
  "ele",
  "eles",
  "em",
  "entre",
  "era",
  "eram",
  "essa",
  "essas",
  "esse",
  "esses",
  "esta",
  "está",
  "estao",
  "estão",
  "estas",
  "este",
  "estes",
  "eu",
  "foi",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isso",
  "isto",
  "it",
  "its",
  "itself",
  "mais",
  "mas",
  "me",
  "mesmo",
  "meu",
  "meus",
  "minha",
  "minhas",
  "na",
  "nao",
  "não",
  "nas",
  "no",
  "nos",
  "nós",
  "o",
  "of",
  "on",
  "once",
  "only",
  "or",
  "os",
  "other",
  "ou",
  "our",
  "ours",
  "ourselves",
  "para",
  "pela",
  "pelas",
  "pelo",
  "pelos",
  "por",
  "qual",
  "quando",
  "que",
  "quem",
  "quais",
  "se",
  "sem",
  "ser",
  "seu",
  "seus",
  "she",
  "should",
  "so",
  "sobre",
  "some",
  "sua",
  "suas",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "tu",
  "um",
  "uma",
  "umas",
  "uns",
  "up",
  "very",
  "voce",
  "você",
  "vocês",
  "vos",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

type ExtractRelatedTermsInput = {
  question: string;
  sourceExcerpts: string[];
  limit?: number;
};

type RelatedTermAccumulator = {
  canonicalTerm: string;
  canonicalTokens: string[];
  ngramSize: number;
  frequency: number;
  sourceIndexes: Set<number>;
  variantCounts: Map<string, number>;
};

type RankedRelatedTerm = {
  term: string;
  canonicalTokens: string[];
  ngramSize: number;
  frequency: number;
  sourceCoverageCount: number;
};

type NormalizedToken = {
  canonical: string;
  display: string;
};

export type RelatedTerm = {
  rank: number;
  term: string;
  ngramSize: number;
  frequency: number;
  sourceCoverageCount: number;
};

export function extractRelatedTerms(input: ExtractRelatedTermsInput): RelatedTerm[] {
  const limit = normalizeLimit(input.limit);
  if (limit === 0) {
    return [];
  }

  const segments = [
    createSegment(input.question, null),
    ...input.sourceExcerpts.map((excerpt, index) => createSegment(excerpt, index)),
  ].filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return [];
  }

  const accumulatedTerms = new Map<string, RelatedTermAccumulator>();

  for (const segment of segments) {
    for (let ngramSize = 1; ngramSize <= MAX_NGRAM_SIZE; ngramSize += 1) {
      if (segment.tokens.length < ngramSize) {
        break;
      }

      for (let index = 0; index <= segment.tokens.length - ngramSize; index += 1) {
        const tokens = segment.tokens.slice(index, index + ngramSize);
        const canonicalTerm = tokens.map((token) => token.canonical).join(" ");
        const displayTerm = tokens.map((token) => token.display).join(" ");

        const existing = accumulatedTerms.get(canonicalTerm);
        if (existing) {
          existing.frequency += 1;
          existing.variantCounts.set(
            displayTerm,
            (existing.variantCounts.get(displayTerm) ?? 0) + 1,
          );
          if (segment.sourceIndex !== null) {
            existing.sourceIndexes.add(segment.sourceIndex);
          }
          continue;
        }

        const sourceIndexes = new Set<number>();
        if (segment.sourceIndex !== null) {
          sourceIndexes.add(segment.sourceIndex);
        }

        accumulatedTerms.set(canonicalTerm, {
          canonicalTerm,
          canonicalTokens: tokens.map((token) => token.canonical),
          ngramSize,
          frequency: 1,
          sourceIndexes,
          variantCounts: new Map([[displayTerm, 1]]),
        });
      }
    }
  }

  const rankedTerms = Array.from(accumulatedTerms.values(), finalizeAccumulator).sort(
    compareRankedTerms,
  );

  return suppressRedundantTerms(rankedTerms)
    .slice(0, limit)
    .map((term, index) => ({
      rank: index + 1,
      term: term.term,
      ngramSize: term.ngramSize,
      frequency: term.frequency,
      sourceCoverageCount: term.sourceCoverageCount,
    }));
}

function createSegment(text: string, sourceIndex: number | null) {
  const tokens = tokenize(text);

  return {
    sourceIndex,
    tokens,
    length: tokens.length,
  };
}

function tokenize(text: string): NormalizedToken[] {
  const normalizedText = collapseWhitespace(text).trim().toLowerCase();
  const tokens = normalizedText.match(ALPHANUMERIC_TOKEN_PATTERN) ?? [];

  return tokens.flatMap((token) => {
    const canonical = toCanonicalToken(token);
    if (canonical.length === 0 || NUMERIC_TOKEN_PATTERN.test(canonical)) {
      return [];
    }

    if (!DOMAIN_ACRONYM_ALLOWLIST.has(canonical) && STOPWORDS.has(canonical)) {
      return [];
    }

    return [{
      canonical,
      display: token,
    }];
  });
}

function finalizeAccumulator(term: RelatedTermAccumulator): RankedRelatedTerm {
  return {
    term: selectDisplayVariant(term.variantCounts),
    canonicalTokens: term.canonicalTokens,
    ngramSize: term.ngramSize,
    frequency: term.frequency,
    sourceCoverageCount: term.sourceIndexes.size,
  };
}

function selectDisplayVariant(variantCounts: Map<string, number>): string {
  const rankedVariants = Array.from(variantCounts.entries()).sort((left, right) => {
    const [leftVariant, leftCount] = left;
    const [rightVariant, rightCount] = right;

    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }

    return compareStrings(leftVariant, rightVariant);
  });

  return rankedVariants[0]?.[0] ?? "";
}

function compareRankedTerms(left: RankedRelatedTerm, right: RankedRelatedTerm): number {
  if (left.sourceCoverageCount !== right.sourceCoverageCount) {
    return right.sourceCoverageCount - left.sourceCoverageCount;
  }

  if (left.frequency !== right.frequency) {
    return right.frequency - left.frequency;
  }

  if (left.ngramSize !== right.ngramSize) {
    return right.ngramSize - left.ngramSize;
  }

  return compareStrings(left.term, right.term);
}

function suppressRedundantTerms(terms: RankedRelatedTerm[]): RankedRelatedTerm[] {
  const selected: RankedRelatedTerm[] = [];

  for (const term of terms) {
    const isRedundant = selected.some((selectedTerm) => (
      selectedTerm.frequency === term.frequency &&
      selectedTerm.sourceCoverageCount === term.sourceCoverageCount &&
      selectedTerm.ngramSize > term.ngramSize &&
      containsContiguousSubsequence(
        selectedTerm.canonicalTokens,
        term.canonicalTokens,
      )
    ));

    if (!isRedundant) {
      selected.push(term);
    }
  }

  return selected;
}

function containsContiguousSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matches = true;

    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_RELATED_TERMS_LIMIT;
  }

  return Math.max(0, Math.min(MAX_RELATED_TERMS_LIMIT, Math.floor(limit)));
}

function toCanonicalToken(token: string): string {
  return token.normalize("NFD").replace(DIACRITIC_PATTERN, "");
}

function collapseWhitespace(value: string): string {
  return value.replace(WHITESPACE_PATTERN, " ");
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
