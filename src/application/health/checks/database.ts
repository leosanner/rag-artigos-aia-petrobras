import { sql } from "drizzle-orm";

import type { db } from "@/db/client";

import type { HealthCheck } from "../check-health";

export function createDatabaseCheck(database: typeof db): HealthCheck {
  return {
    name: "database",
    run: async () => {
      await database.execute(sql`SELECT 1`);
    },
  };
}
