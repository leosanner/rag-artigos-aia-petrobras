import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://aia_insight:aia_insight@localhost:5432/aia_insight",
    ssl: process.env.NODE_ENV !== "development" ? true : false,
  },
});
