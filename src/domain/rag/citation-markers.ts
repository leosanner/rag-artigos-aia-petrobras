import type { RagSource } from "./context-assembler";

const BRACKET_TOKEN_PATTERN = /\[([^\]]*)\]/g;
const CANONICAL_CITATION_PATTERN = /^[1-9]\d*$/;

export class CitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CitationValidationError";
  }
}

export function extractCitationNumbers(answer: string): number[] {
  return findBracketTokenContents(answer)
    .filter((content) => CANONICAL_CITATION_PATTERN.test(content))
    .map((content) => Number(content));
}

export function assertValidCitationMarkers(
  answer: string,
  sources: RagSource[],
): void {
  const bracketTokens = findBracketTokenContents(answer);

  for (const content of bracketTokens) {
    if (!CANONICAL_CITATION_PATTERN.test(content)) {
      throw new CitationValidationError("Answer contains malformed citation markers");
    }
  }

  const citationNumbers = extractCitationNumbers(answer);
  const availableSourceNumbers = new Set(
    sources.map((source) => source.sourceNumber),
  );

  if (sources.length === 0) {
    if (citationNumbers.length > 0) {
      throw new CitationValidationError("Answer cites sources that are not available");
    }
    return;
  }

  if (citationNumbers.length === 0) {
    throw new CitationValidationError(
      "Answer must include at least one citation marker when sources exist",
    );
  }

  for (const citationNumber of citationNumbers) {
    if (!availableSourceNumbers.has(citationNumber)) {
      throw new CitationValidationError(
        "Answer cites a source number outside the available source range",
      );
    }
  }
}

function findBracketTokenContents(answer: string): string[] {
  return Array.from(answer.matchAll(BRACKET_TOKEN_PATTERN), (match) => match[1] ?? "");
}
