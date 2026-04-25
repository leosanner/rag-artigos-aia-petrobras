export const GENERATION_FAILURE_CODES = Object.freeze([
  "generation_failed",
  "generation_unavailable",
] as const);

export type GenerationFailureCode = (typeof GENERATION_FAILURE_CODES)[number];
const NO_EVIDENCE_ANSWER =
  "Não encontrei evidências suficientes nos documentos recuperados para responder com segurança.";
const NORMALIZED_NO_EVIDENCE_ANSWER = normalizeNoEvidenceAnswer(NO_EVIDENCE_ANSWER);

export class GenerationFailure extends Error {
  readonly code: GenerationFailureCode;

  constructor(code: GenerationFailureCode, message: string) {
    super(message);
    this.name = "GenerationFailure";
    this.code = isGenerationFailureCode(code) ? code : "generation_failed";
  }
}

export function buildNoEvidenceAnswer(): string {
  return NO_EVIDENCE_ANSWER;
}

export function isNoEvidenceAnswer(answer: string): boolean {
  return normalizeNoEvidenceAnswer(answer) === NORMALIZED_NO_EVIDENCE_ANSWER;
}

export function toSafeGenerationFailureCode(
  err: unknown,
): GenerationFailureCode {
  if (err instanceof GenerationFailure && isGenerationFailureCode(err.code)) {
    return err.code;
  }

  return "generation_failed";
}

function isGenerationFailureCode(value: unknown): value is GenerationFailureCode {
  return GENERATION_FAILURE_CODES.includes(value as GenerationFailureCode);
}

function normalizeNoEvidenceAnswer(answer: string): string {
  return answer
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*[.!?…]+\s*$/u, "")
    .trim();
}
