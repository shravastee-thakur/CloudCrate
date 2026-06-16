import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  MONGO_URL: z.string().url("MONGO_URI must be a valid URL"),
  HMAC_SECRET: z.string().min(10, "HMAC_SECRET is required and must be secure"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  NETLIFY_URL: z.string().url("NETLIFY_URL must be a valid URL"),

  ACCESS_SECRET: z.string().min(1),
  REFRESH_SECRET: z.string().min(1),

  IOREDIS_URL: z.string().url("IOREDIS_URL must be a valid URL"),

  BREVO_API_KEY: z.string().min(1),
  SENDER_EMAIL: z.string().email("SENDER_EMAIL must be a valid email address"),
  ARCJET_KEY: z.string().min(1),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:");
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;
