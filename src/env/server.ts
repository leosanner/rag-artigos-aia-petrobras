import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    DATABASE_URL: z.string().url(),
    GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z
      .string()
      .min(1)
      .transform((key) => key.replace(/\\n/g, "\n")),
    INGESTION_SYNC_SECRET: optionalNonEmptyString,
    INNGEST_DEV: optionalNonEmptyString,
    INNGEST_EVENT_KEY: optionalNonEmptyString,
    INNGEST_SIGNING_KEY: optionalNonEmptyString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "test" && !env.INGESTION_SYNC_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INGESTION_SYNC_SECRET"],
        message: "INGESTION_SYNC_SECRET is required unless NODE_ENV=test",
      });
    }

    const mayOmitInngestCloudKeys =
      env.NODE_ENV === "test" || env.INNGEST_DEV !== undefined;

    if (mayOmitInngestCloudKeys) {
      return;
    }

    if (!env.INNGEST_EVENT_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INNGEST_EVENT_KEY"],
        message:
          "INNGEST_EVENT_KEY is required unless NODE_ENV=test or INNGEST_DEV is set",
      });
    }

    if (!env.INNGEST_SIGNING_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INNGEST_SIGNING_KEY"],
        message:
          "INNGEST_SIGNING_KEY is required unless NODE_ENV=test or INNGEST_DEV is set",
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

export function parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  return envSchema.parse(input);
}

const testEnvDefaults = {
  DATABASE_URL: "postgres://aia_insight:aia_insight@localhost:5432/aia_insight_test",
  GOOGLE_DRIVE_FOLDER_ID: "test-drive-folder",
  GOOGLE_SERVICE_ACCOUNT_EMAIL:
    "test-service-account@example.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
  INGESTION_SYNC_SECRET: "test-ingestion-sync-secret",
  INNGEST_DEV: "1",
};

export const env = parseServerEnv(
  process.env.NODE_ENV === "test"
    ? { ...testEnvDefaults, ...process.env }
    : process.env,
);
