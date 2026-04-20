import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/env/server";

import { buildPoolConfig } from "./connection-config";
import * as schema from "./schema";

const pool = new Pool(buildPoolConfig(env.DATABASE_URL));

export const db = drizzle(pool, { schema });
