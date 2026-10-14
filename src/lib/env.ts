import "server-only";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_TIMEZONE: z.string().default("Asia/Colombo"),
  SMSLENZ_USER_ID: z.string().optional(),
  SMSLENZ_API_KEY: z.string().optional(),
  SMSLENZ_SENDER_ID: z.string().optional(),
  SMSLENZ_API_URL: z.string().url().default("https://smslenz.lk/api/send-sms"),
});

export function getEnv() {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    SMSLENZ_USER_ID: process.env.SMSLENZ_USER_ID,
    SMSLENZ_API_KEY: process.env.SMSLENZ_API_KEY,
    SMSLENZ_SENDER_ID: process.env.SMSLENZ_SENDER_ID,
    SMSLENZ_API_URL: process.env.SMSLENZ_API_URL,
  });
}
