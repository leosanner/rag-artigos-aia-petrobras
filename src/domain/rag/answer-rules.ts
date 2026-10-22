import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

export const GENERATION_FAILURE_CODES = Object.freeze([
  "generation_failed",
  "generation_unavailable",
] as const);

export type GenerationFailureCode = (typeof GENERATION_FAILURE_CODES)[number];
const NO_EVIDENCE_ANSWERS: Readonly<Record<Locale, string>> = Object.freeze({
  "pt-BR": "Não encontrei nada relacionado a essa pergunta na base de dados.",
  en: "I could not find anything related to this question in the database.",
});
const NORMALIZED_NO_EVIDENCE_ANSWERS = new Set(
  Object.values(NO_EVIDENCE_ANSWERS).map(normalizeNoEvidenceAnswer),
);
const LEGACY_NO_EVIDENCE_ANSWERS = new Set([
  "Não encontrei nada relacionado a essa pergunta na base.",
  "Não encontrei nada relacionado a essa pergunta na base de dados consultada.",
  "Não achei nada relacionado a essa pergunta na base de dados.",
  "Não encontrei evidências suficientes nos documentos recuperados para responder com segurança.",
].map(normalizeNoEvidenceAnswer));

export class GenerationFailure extends Error {
  readonly code: GenerationFailureCode;

  constructor(code: GenerationFailureCode, message: string) {
    super(message);
    this.name = "GenerationFailure";
    this.code = isGenerationFailureCode(code) ? code : "generation_failed";
  }
}

export function buildNoEvidenceAnswer(
  language: Locale = DEFAULT_LOCALE,
): string {
  return NO_EVIDENCE_ANSWERS[language];
}

// Each answer language is a distinct prompt, so the persisted prompt version
// must identify it. Portuguese keeps the base version for trace continuity.
export function resolvePromptVersionForLanguage(
  basePromptVersion: string,
  language: Locale,
): string {
  return language === DEFAULT_LOCALE
    ? basePromptVersion
    : `${basePromptVersion}.${language}`;
}

export function isNoEvidenceAnswer(answer: string): boolean {
  const normalizedAnswer = normalizeNoEvidenceAnswer(answer);

  return (
    NORMALIZED_NO_EVIDENCE_ANSWERS.has(normalizedAnswer) ||
    LEGACY_NO_EVIDENCE_ANSWERS.has(normalizedAnswer)
  );
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
