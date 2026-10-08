import 'dotenv/config';

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  jwtExpires: string;
  port: number;
  webOrigin: string;
  publicWebUrl: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  groqApiKey: string;
}

export const HOSTED_WEB_ORIGIN = 'https://spineer-fe.vercel.app';

function resolveWebUrl(value: string | undefined, env: NodeJS.ProcessEnv) {
  const cleaned = (value || '').replace(/\/$/, '');
  const local = !cleaned || /localhost|127\.0\.0\.1/.test(cleaned);
  if (local && env.NODE_ENV === 'production') return HOSTED_WEB_ORIGIN;
  return cleaned || 'http://localhost:5173';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment: ${missing.join(', ')}`);
  }
  return {
    databaseUrl: env.DATABASE_URL as string,
    jwtSecret: env.JWT_SECRET as string,
    jwtExpires: env.JWT_EXPIRES || '12h',
    port: Number(env.PORT || 3001),
    webOrigin: resolveWebUrl(env.WEB_ORIGIN, env),
    publicWebUrl: resolveWebUrl(env.PUBLIC_WEB_URL, env),
    vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
    vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    groqApiKey: env.GROQ_API_KEY || '',
  };
}
