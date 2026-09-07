import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnv } from './config/validation';
import { DiscordModule } from './modules/discord/discord.module';
import { SpotifyModule } from './modules/spotify/spotify.module';

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
      getTracker: (req) => {
        const cf = req.headers?.['cf-connecting-ip']
        if (typeof cf === 'string' && cf.length > 0) return cf
        const forwarded = req.headers?.['x-forwarded-for']
        if (typeof forwarded === 'string' && forwarded.length > 0) {
          return forwarded.split(',')[0].trim()
        }
        return req.ips?.[0] ?? req.ip ?? 'unknown'
      },
    }),
    SpotifyModule,
    DiscordModule,
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
