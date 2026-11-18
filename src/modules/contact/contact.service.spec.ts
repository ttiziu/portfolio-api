import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  const originalFetch = global.fetch;
  const input = { name: 'Ana', email: 'ana@example.com', message: 'Hola' };
  const resend = { apiKey: 'test', from: 'a@test.dev', to: 'b@test.dev' };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function service(config: object = { resend }) {
    return new ContactService(new ConfigService(config));
  }

  it('drops honeypot submissions without calling Resend', async () => {
    global.fetch = jest.fn();
    await expect(
      service().send({ ...input, company: 'bot inc' }),
    ).resolves.toEqual({ ok: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when Resend is not configured', async () => {
    await expect(service({ resend: {} }).send(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 502 when Resend rejects the message', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    );
    await expect(service().send(input)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('strips newlines from the name used in the subject', async () => {
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.resolve(Response.json({ id: '1' })),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await service().send({ ...input, name: 'Ana\r\nBcc: x@evil.dev' });
    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body as string) as { subject: string };
    expect(body.subject).toBe('Note from Ana Bcc: x@evil.dev');
  });
});
