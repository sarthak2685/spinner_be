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
    webOrigin: env.WEB_ORIGIN || 'http://localhost:5173',
    publicWebUrl: env.PUBLIC_WEB_URL || 'http://localhost:5173',
    vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
    vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    groqApiKey: env.GROQ_API_KEY || '',
  };
}
