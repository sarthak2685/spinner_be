export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export function clientIp(headers: Record<string, string | string[] | undefined>, fallback = '127.0.0.1'): string {
  const cf = header(headers, 'cf-connecting-ip');
  if (cf) return cf;
  const xff = header(headers, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return fallback;
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
