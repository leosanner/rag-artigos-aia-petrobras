import { z } from "zod";

export const SelectableRagDocumentSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1),
    authors: z.string().min(1).nullable(),
    publicationYear: z.number().int().positive().nullable(),
    doi: z.string().min(1).nullable(),
    chunkCount: z.number().int().nonnegative(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SelectableRagDocument = z.infer<typeof SelectableRagDocumentSchema>;
