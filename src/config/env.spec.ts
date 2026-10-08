import { loadConfig } from './env';

describe('env', () => {
  it('fails fast when required keys are missing', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('reads a complete config', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://localhost/db', JWT_SECRET: 's' });
    expect(config.port).toBe(3001);
    expect(config.jwtSecret).toBe('s');
  });
});
