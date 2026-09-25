import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactDto } from './contact.dto';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: ContactDto): Promise<{ ok: true }> {
    if (input.company?.trim()) {
      return { ok: true };
    }

    const apiKey = this.config.get<string>('resend.apiKey') ?? '';
    const from = this.config.get<string>('resend.from') ?? '';
    const to = this.config.get<string>('resend.to') ?? '';

    if (!apiKey || !from || !to) {
      throw new ServiceUnavailableException('Contact is not configured');
    }

    const name = input.name.replace(/[\r\n]+/g, ' ').trim();
    const email = input.email.trim();
    const message = input.message.trim();

    let response: Response;
    try {
      response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: `Note from ${name}`,
          text: `${message}\n\n${name}\n${email}`,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Resend request failed',
      );
      throw new BadGatewayException('Could not send message');
    }

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
      throw new BadGatewayException('Could not send message');
    }

    return { ok: true };
  }
}
