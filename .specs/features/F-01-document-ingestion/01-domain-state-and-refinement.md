# 01 - Domain State and Refinement

## Goal

Build the pure business-logic foundation for F-01 before touching external services or API routes.

## Scope

- Document status transition rules for `pending`, `processed`, and `failed`.
- Safe ingestion error codes that can be persisted and returned without leaking provider details.
- Deterministic text refinement with no LLM, embedding provider, Drive, or database dependency.

## Implementation Notes

- Create the domain modules listed in `spec.md`:
  - `src/domain/documents/status.ts`
  - `src/domain/documents/errors.ts`
  - `src/domain/text/deterministic-refiner.ts`
- The state machine must reject invalid transitions with a typed error.
- The refiner should normalize whitespace, remove control characters, join words hyphenated across line breaks, and preserve semantic content.
- Empty or whitespace-only refined output must be classified as `refined_text_empty`.

## Tests First

- Unit tests for valid transitions: `pending -> processed`, `pending -> failed`.
- Unit tests for invalid transitions, including direct `processed -> pending`.
- Unit tests for safe error-code mapping.
- Unit tests for deterministic refinement: whitespace normalization, dehyphenation across line breaks, control-character cleanup, and empty-output failure.

## Done When

- Business logic is fully covered by unit tests.
- No infrastructure imports exist in domain modules.
- `pnpm test` passes for the new domain tests.
