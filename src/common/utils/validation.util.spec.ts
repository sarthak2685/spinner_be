import { isValidEmail, isValidMobile, normalizeMobile, validateImage } from './validation.util';

describe('validation', () => {
  it('accepts only a 10-digit Indian mobile', () => {
    expect(normalizeMobile('98765 43210')).toBe('9876543210');
    expect(normalizeMobile('+91 9876543210')).toBe('');
    expect(normalizeMobile('09876543210')).toBe('');
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('+919876543210')).toBe(false);
    expect(isValidMobile('1234567890')).toBe(false);
    expect(isValidMobile('98765')).toBe(false);
  });

  it('checks email and image uploads', () => {
    expect(isValidEmail('owner@shop.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(validateImage(undefined)).toBeNull();
    expect(validateImage({ originalname: 'a.gif', mimetype: 'image/gif', size: 10 })).toMatch(/Only image/);
  });
});
