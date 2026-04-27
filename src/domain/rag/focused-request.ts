import { z } from "zod";

import { RagRetrievalSettingsSchema } from "./retrieval-settings";

export const FocusedRagAskRequestSchema = z
  .object({
    question: z.string().trim().min(1),
    mode: z.literal("focused"),
    documentId: z.string().uuid(),
    retrieval: RagRetrievalSettingsSchema.optional(),
  })
  .strict();

export type FocusedRagAskRequest = z.infer<typeof FocusedRagAskRequestSchema>;
