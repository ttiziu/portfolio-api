import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DISCORD_TIMEOUT_MS = 2500;
const DISCORD_AVATAR_SIZE = 256;
const CACHE_MS = 5 * 60 * 1000;

@Injectable()
export class DiscordService {
  private cache: { avatar: string | null; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async getAvatarUrl(): Promise<{ avatar: string | null }> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return { avatar: this.cache.avatar };
    }

    const token = this.config.get<string>('discord.botToken') ?? '';
    const userId = this.config.get<string>('discord.userId') ?? '';

    if (!token || !userId) {
      return this.write(null);
    }

    try {
      const response = await fetch(
        `https://discord.com/api/v10/users/${userId}`,
        {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        return this.write(null);
      }

      const user = (await response.json()) as {
        id?: string;
        avatar?: string | null;
      };

      if (!user.id || !user.avatar) {
        return this.write(null);
      }

      const avatar = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${DISCORD_AVATAR_SIZE}`;
      return this.write(avatar);
    } catch {
      return this.write(null);
    }
  }

  private write(avatar: string | null) {
    this.cache = { avatar, expiresAt: Date.now() + CACHE_MS };
    return { avatar };
  }
}
