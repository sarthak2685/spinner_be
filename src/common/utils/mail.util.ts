import nodemailer from 'nodemailer';

type DemoMail = { name: string; mobile: string; email: string; businessName: string; businessType?: string; city?: string };

export function demoMailConfigured() {
  const env = process.env;
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.DEMO_TO);
}

export async function sendDemoMail(input: DemoMail) {
  const env = process.env;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.DEMO_TO) return false;
  const port = Number(env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const lines = [
    `Name: ${input.name}`,
    `Mobile: ${input.mobile}`,
    `Email: ${input.email}`,
    `Business: ${input.businessName}`,
    input.businessType ? `Type: ${input.businessType}` : '',
    input.city ? `City: ${input.city}` : '',
  ].filter(Boolean);
  await transport.sendMail({
    from: env.SMTP_USER,
    to: env.DEMO_TO,
    replyTo: input.email,
    subject: `Demo request: ${input.businessName}`,
    text: lines.join('\n'),
  });
  return true;
}
