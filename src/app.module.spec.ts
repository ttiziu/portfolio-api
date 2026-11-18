import { clientTracker } from './app.module';

describe('clientTracker', () => {
  it('ignores a spoofed X-Forwarded-For and uses req.ip', () => {
    expect(
      clientTracker({
        headers: { 'x-forwarded-for': '1.2.3.4' },
        ip: '9.9.9.9',
      }),
    ).toBe('9.9.9.9');
  });

  it('prefers the Cloudflare client IP', () => {
    expect(
      clientTracker({
        headers: { 'cf-connecting-ip': '5.6.7.8' },
        ip: '9.9.9.9',
      }),
    ).toBe('5.6.7.8');
  });
});
