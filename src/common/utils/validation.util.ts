const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return email.length <= 100 && EMAIL.test(email);
}

export function normalizeMobile(mobile: string): string {
  if (!mobile || !mobile.trim()) return '';
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 ? digits : '';
}

export function isValidMobile(mobile: string): boolean {
  const normalized = normalizeMobile(mobile);
  return normalized.length === 10 && INDIAN_MOBILE.test(normalized);
}

export function validateVideo(file?: { originalname?: string; mimetype?: string; size?: number }, maxBytes = 80 * 1024 * 1024): string | null {
  if (!file || !(file.size || 0)) return 'Choose a video file.';
  const name = file.originalname || '';
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!['.mp4', '.webm'].includes(ext)) return 'Only MP4 and WebM videos are allowed.';
  if ((file.size || 0) > maxBytes) return `Video size must not exceed ${Math.floor(maxBytes / (1024 * 1024))}MB.`;
  const mime = (file.mimetype || '').toLowerCase();
  if (mime !== 'video/mp4' && mime !== 'video/webm') return 'Uploaded file content is not a valid video.';
  return null;
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
