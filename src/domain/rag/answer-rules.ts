export const GENERATION_FAILURE_CODES = Object.freeze([
  "generation_failed",
  "generation_unavailable",
] as const);

export type GenerationFailureCode = (typeof GENERATION_FAILURE_CODES)[number];

export class GenerationFailure extends Error {
  readonly code: GenerationFailureCode;

  constructor(code: GenerationFailureCode, message: string) {
    super(message);
    this.name = "GenerationFailure";
    this.code = isGenerationFailureCode(code) ? code : "generation_failed";
  }
}

export function buildNoEvidenceAnswer(): string {
  return "Não encontrei evidências suficientes nos documentos recuperados para responder com segurança.";
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
