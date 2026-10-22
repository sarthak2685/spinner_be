import nodemailer from 'nodemailer';

type DemoMail = { name: string; mobile: string; email: string; businessName: string; businessType?: string; city?: string };
type ResetMail = { to: string; resetUrl: string };

function smtpReady() {
  const env = process.env;
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function fromAddress() {
  const env = process.env;
  return env.SMTP_FROM || env.SMTP_USER || '';
}

function createTransport() {
  const env = process.env;
  const port = Number(env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export function demoMailConfigured() {
  return smtpReady() && Boolean(process.env.DEMO_TO);
}

export function mailConfigured() {
  return smtpReady() && Boolean(fromAddress());
}

export async function sendDemoMail(input: DemoMail) {
  const env = process.env;
  if (!demoMailConfigured() || !env.DEMO_TO) return false;
  const lines = [
    `Name: ${input.name}`,
    `Mobile: ${input.mobile}`,
    `Email: ${input.email}`,
    `Business: ${input.businessName}`,
    input.businessType ? `Type: ${input.businessType}` : '',
    input.city ? `City: ${input.city}` : '',
  ].filter(Boolean);
  await createTransport().sendMail({
    from: fromAddress(),
    to: env.DEMO_TO,
    replyTo: input.email,
    subject: `Demo request: ${input.businessName}`,
    text: lines.join('\n'),
  });
  return true;
}

export async function sendPasswordResetMail(input: ResetMail) {
  if (!mailConfigured()) return false;
  const text = [
    'We received a request to reset your RepeatMate password.',
    '',
    'Open this link to choose a new password (valid for 1 hour):',
    input.resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `
    <p>We received a request to reset your RepeatMate password.</p>
    <p><a href="${input.resetUrl}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
  `;
  await createTransport().sendMail({
    from: fromAddress(),
    to: input.to,
    subject: 'Reset your RepeatMate password',
    text,
    html,
  });
  return true;
}
