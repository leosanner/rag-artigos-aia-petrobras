import { createHash } from "node:crypto";

import type { FileHasher } from "@/application/ingestion/ports";

export class Sha256FileHasher implements FileHasher {
  hash(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
