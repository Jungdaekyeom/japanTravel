import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SESSION_PEPPER: z.string().min(16),
  INVITE_TOKEN: z.string().min(1),
});

const googleRoutesEnvSchema = z.object({
  GOOGLE_ROUTES_API_KEY: z.string().min(1),
  GOOGLE_PLACE_ID_KIX: z.string().min(1),
  GOOGLE_PLACE_ID_KYOTO_STATION: z.string().min(1),
  GOOGLE_PLACE_ID_ODAWARA_STATION: z.string().min(1),
  GOOGLE_PLACE_ID_TOKYO_STATION: z.string().min(1),
  GOOGLE_PLACE_ID_KEISEI_UENO_STATION: z.string().min(1),
  GOOGLE_PLACE_ID_NARITA_AIRPORT: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type GoogleRoutesEnv = z.infer<typeof googleRoutesEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Missing required server environment variables");
  return parsed.data;
}

export function getGoogleRoutesEnv(): GoogleRoutesEnv {
  const parsed = googleRoutesEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Missing required Google Routes environment variables");
  return parsed.data;
}
