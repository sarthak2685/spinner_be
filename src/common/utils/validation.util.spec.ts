import { isValidEmail, isValidMobile, normalizeMobile, validateImage } from './validation.util';

describe('validation', () => {
  it('normalizes Indian mobiles', () => {
    expect(normalizeMobile('+91 98765-43210')).toBe('9876543210');
    expect(normalizeMobile('09876543210')).toBe('9876543210');
    expect(isValidMobile('9876543210')).toBe(true);
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
