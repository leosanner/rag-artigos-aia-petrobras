import { ListRagDocuments } from "@/application/rag/list-rag-documents";
import { db } from "@/db/client";
import { env } from "@/env/server";
import { DocumentsRepository } from "@/repositories/documents-repository";

import { createRagDocumentsHandler } from "./handler";

export const dynamic = "force-dynamic";

const documentsRepository = new DocumentsRepository(db);
const listDocuments = new ListRagDocuments({
  selectableDocumentsReader: documentsRepository,
});

export const GET = createRagDocumentsHandler({
  listDocuments,
  secret: env.RAG_QUERY_SECRET ?? "",
});
