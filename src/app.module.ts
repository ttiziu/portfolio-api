import type { Request } from 'express';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnv } from './config/validation';
import { ContactModule } from './modules/contact/contact.module';
import { GithubModule } from './modules/github/github.module';
import { DiscordModule } from './modules/discord/discord.module';
import { SpotifyModule } from './modules/spotify/spotify.module';

// Cloudflare overwrites cf-connecting-ip, so it is safe while the origin is only
// reachable through Cloudflare. Raw X-Forwarded-For is client-controlled and is
// never read here; req.ip already resolves it via `trust proxy`.
export function clientTracker(
  req: Partial<Pick<Request, 'headers' | 'ip'>>,
): string {
  const cf = req.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.length > 0) return cf;
  return req.ip ?? 'unknown';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 30 }],
      getTracker: clientTracker,
    }),
    SpotifyModule,
    DiscordModule,
    GithubModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
