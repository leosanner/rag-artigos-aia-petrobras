import { env } from "@/env/server";

import { createRagAskHandler } from "./handler";
import { answerQuestion } from "../runtime";

export const dynamic = "force-dynamic";

export const POST = createRagAskHandler({
  answerQuestion,
  secret: env.RAG_QUERY_SECRET ?? "",
});
