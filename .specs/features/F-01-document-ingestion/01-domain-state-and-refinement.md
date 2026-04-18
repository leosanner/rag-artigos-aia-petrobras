# 01 - Domain State and Refinement

## Goal

Build the pure business-logic foundation for F-01 before touching external services or API routes. This block delivers the three domain modules that every other F-01 block (persistence, infrastructure, interface) will import without any reverse dependency.

## Scope

- Document status transition rules for `pending`, `processed`, and `failed`.
- Safe ingestion error codes that can be persisted in `documents.last_error` / `ingestion_run_items.last_error` and returned to API clients without leaking provider details.
- Deterministic text refinement with no LLM, embedding provider, Drive, or database dependency.

**Out of scope for this block:** repositories, Drive adapter, PDF extractor, Inngest, route handlers, Zod schemas for API responses, chunking. Those live in blocks 02–05.

## Applicable Rules (from parent `spec.md`)

| Rule | Statement (abridged) | This block |
|---|---|---|
| RN-08 | Document starts as `pending` and transitions only to `processed` or `failed` in F-01. | State machine encodes it. |
| RN-09 | `processed` requires `raw_text` and `refined_text` non-empty. | Refiner enforces non-empty output; caller enforces `raw_text` check in block 03. |
| RN-10 | Failures after document creation persist `last_error` on the document. | Error codes are safe for that column. |
| RN-11 | Failures before document creation persist `last_error` on the run item. | Same error catalog is reused. |
| RN-13 | Text refinement is deterministic and must not call an LLM or embedding provider. | Module has zero external imports. |
| INV-03 | `processed` always has non-empty `raw_text` and `refined_text`. | Refiner rejects empty output. |
| INV-04 | `failed` documents stay inspectable. | Errors never throw away context (code is preserved). |
| INV-10 | Secrets and raw provider errors never appear in API response bodies. | `toSafeErrorCode` maps any `unknown` to a code from the closed catalog; never serializes `err.message`. |

## Functional Requirements (block-scoped)

Each RF is unit-testable in isolation. Prefix `RF-B01-` to distinguish from feature-level RFs in `spec.md`.

**Status state machine** (`src/domain/documents/status.ts`):

- RF-B01-01: `transitionStatus("pending", "processed")` returns `"processed"`.
- RF-B01-02: `transitionStatus("pending", "failed")` returns `"failed"`.
- RF-B01-03: Any transition from a terminal state (`processed`, `failed`) throws `InvalidStatusTransitionError` carrying `from` and `to`.
- RF-B01-04: Self-transitions (e.g. `pending → pending`) throw `InvalidStatusTransitionError`.
- RF-B01-05: `canTransition(from, to)` returns `true` iff `transitionStatus(from, to)` would not throw; never throws itself.
- RF-B01-06: `InvalidStatusTransitionError` is `instanceof Error` and exposes the invalid `from`/`to` as readonly fields.

**Ingestion errors** (`src/domain/documents/errors.ts`):

- RF-B01-07: `IngestionError` stores a readonly `code: IngestionErrorCode` and a human-readable `message`.
- RF-B01-08: `IngestionError` is `instanceof Error`.
- RF-B01-09: `toSafeErrorCode(err)` returns `err.code` when `err` is an `IngestionError`.
- RF-B01-10: `toSafeErrorCode(err)` returns `"unknown_error"` for any non-`IngestionError` input (plain `Error`, `string`, `undefined`, `null`, `{}`, etc.).
- RF-B01-11: `toSafeErrorCode(err)` must not propagate `err.message`, `err.stack`, or any other property of the input; the returned string is strictly drawn from `IngestionErrorCode`.

**Deterministic refiner** (`src/domain/text/deterministic-refiner.ts`):

- RF-B01-12: `refineText` collapses runs of spaces and tabs into a single space, preserving line breaks.
- RF-B01-13: `refineText` normalizes `\r\n` and bare `\r` to `\n`.
- RF-B01-14: `refineText` joins words hyphenated across a single line break (`"photo-\nsynthesis"` → `"photosynthesis"`), only when both sides are word characters.
- RF-B01-15: `refineText` strips C0 control characters (`\x00–\x08`, `\x0B`, `\x0C`, `\x0E–\x1F`) and C1 control characters (`\x7F–\x9F`), while preserving `\n` and `\t`.
- RF-B01-16: `refineText` collapses three or more consecutive line breaks into exactly two (preserves paragraph boundaries).
- RF-B01-17: `refineText` `trim()`s the final output.
- RF-B01-18: `refineText` throws `IngestionError` with code `refined_text_empty` when the input is empty, whitespace-only, or becomes empty after cleanup.
- RF-B01-19: `refineText` does not invent content: the refined output contains no characters that were not in the input (sanity check for "no semantic expansion").

## State Transition Table

Rows are the current state, columns the target state. ✓ = allowed by `transitionStatus`; ✗ = rejected with `InvalidStatusTransitionError`.

| From ↓ / To → | `pending` | `processed` | `failed` |
|---|---|---|---|
| `pending`   | ✗ | ✓ | ✓ |
| `processed` | ✗ | ✗ | ✗ |
| `failed`    | ✗ | ✗ | ✗ |

`processed` and `failed` are terminal in F-01. Reprocessing `failed` documents is declared **out of scope for F-01** by `spec.md` and is not introduced in this block either.

## Error Code Catalog

The catalog is a closed union. All codes are safe for persistence and for inclusion in Zod-validated API response bodies.

| Code | Meaning | Emitted by (future block) |
|---|---|---|
| `drive_download_failed` | Drive returned an error or the bytes could not be fetched before a document was created. | Block 03 |
| `raw_text_empty` | PDF extraction returned no usable text. | Block 03 |
| `extraction_failed` | Extractor threw for any other reason. | Block 03 |
| `refined_text_empty` | Refiner received empty input or produced an empty result after cleanup. | Block 01 (this block) |
| `refinement_failed` | Refiner threw for a non-empty input. Reserved; block 01's deterministic refiner is total except for the empty case, but the code exists so block 03 can catch any unexpected throw safely. | Block 03 |
| `unknown_error` | Generic fallback when the underlying error is not an `IngestionError`. Required by INV-10. | All blocks |

Block 01 uses only `refined_text_empty` and `unknown_error` at runtime; the other codes are declared here so every block speaks the same vocabulary.

## Refinement Algorithm

Applied in this exact order on the input string. Each step is a pure string transformation.

1. Normalize line endings: `\r\n` → `\n`, lone `\r` → `\n`.
2. Strip C0 controls except `\n` and `\t`: regex `[\x00-\x08\x0B\x0C\x0E-\x1F]` → `""`.
3. Strip C1 controls: regex `[\x7F-\x9F]` → `""`.
4. Join line-break hyphenation: regex `(\w)-\n(\w)` → `$1$2` (conservative: both neighbors must be word characters, so ordinary dashes between words with spaces are untouched).
5. Collapse horizontal whitespace: regex `[ \t]+` → `" "`.
6. Collapse vertical whitespace: 3+ consecutive `\n` → exactly `\n\n`.
7. `trim()` the result.
8. If the result is empty, throw `new IngestionError("refined_text_empty", …)`.

The algorithm is total (no branching on unknown unicode) and reversibility is not a goal.

## Module Contracts

These signatures are the public surface the rest of F-01 depends on. No other symbols are exported.

```ts
// src/domain/documents/status.ts
export type DocumentStatus = "pending" | "processed" | "failed";
export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean;
export function transitionStatus(from: DocumentStatus, to: DocumentStatus): DocumentStatus; // throws
export class InvalidStatusTransitionError extends Error {
  readonly from: DocumentStatus;
  readonly to: DocumentStatus;
}
```

```ts
// src/domain/documents/errors.ts
export type IngestionErrorCode =
  | "drive_download_failed"
  | "raw_text_empty"
  | "extraction_failed"
  | "refined_text_empty"
  | "refinement_failed"
  | "unknown_error";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
}
export function toSafeErrorCode(err: unknown): IngestionErrorCode;
```

```ts
// src/domain/text/deterministic-refiner.ts
export function refineText(rawText: string): string; // throws IngestionError("refined_text_empty")
```

`DocumentStatus` is the literal union expressed by the Drizzle `documentStatus` enum in `src/db/schema.ts`. The domain module owns the type; the schema's enum values must stay in sync, but `src/domain/` must not import from `src/db/`.

## Design Patterns (justified per CLAUDE.md)

- **State Machine** for document status: the transition rules are data (a `Record<DocumentStatus, readonly DocumentStatus[]>`), and the operation (`transitionStatus`) either returns the next state or raises a typed error. Aligns with the State Machine pattern called out in `.specs/project/ARCHITECTURE.md` and directly encodes RN-08/INV-03.
- **Typed Domain Errors**: `IngestionError` with a closed `code` union lets consumers do `instanceof` / `switch` discrimination while keeping the wire format (the `code`) tiny and safe for INV-10. A string-only approach would force stringly-typed catch sites.
- **Strategy-ready Pure Function** for refinement: `refineText` has the same shape the `TextRefiner` Strategy advertises in `spec.md` (line 133). Block 03 can wrap it in a class implementation or swap it for an LLM-backed refiner later without changing orchestration.

## Tests First

Every RF above has at least one dedicated unit test. Files:

- `src/domain/documents/errors.test.ts` covers RF-B01-07 through RF-B01-11, plus a regression asserting `JSON.stringify(toSafeErrorCode(err))` never contains a leaked `postgres://…` URL.
- `src/domain/documents/status.test.ts` covers RF-B01-01 through RF-B01-06, iterating every `(from, to)` pair from the transition table.
- `src/domain/text/deterministic-refiner.test.ts` covers RF-B01-12 through RF-B01-19 with one `it()` per algorithm step plus the empty/whitespace failure case.

## Done When

- Every RF-B01-## has at least one passing unit test.
- No infrastructure imports exist under `src/domain/` (no `drizzle`, `unpdf`, `inngest`, `googleapis`, or `@/db`).
- `pnpm test`, `pnpm lint`, and `pnpm typecheck` all pass.
- Block 02 can import `DocumentStatus`, `IngestionError`, `IngestionErrorCode`, `toSafeErrorCode`, and `refineText` without further edits to this block.
