const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return email.length <= 100 && EMAIL.test(email);
}

export function normalizeMobile(mobile: string): string {
  if (!mobile || !mobile.trim()) return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function isValidMobile(mobile: string): boolean {
  const normalized = normalizeMobile(mobile);
  return normalized.length === 10 && INDIAN_MOBILE.test(normalized);
}

export function validateImage(file?: { originalname?: string; mimetype?: string; size?: number }, maxBytes = 2 * 1024 * 1024): string | null {
  if (!file) return null;
  const name = file.originalname || '';
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'Only image files (.png, .jpg, .jpeg, .webp) are allowed.';
  if ((file.size || 0) > maxBytes) return `Image size must not exceed ${Math.floor(maxBytes / (1024 * 1024))}MB.`;
  if (!(file.mimetype || '').toLowerCase().startsWith('image/')) return 'Uploaded file content is not a valid image.';
  return null;
}
