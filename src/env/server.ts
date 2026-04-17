import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1)
});

export const env = envSchema.parse(process.env);
