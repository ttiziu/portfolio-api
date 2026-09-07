import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SPOTIFY_TIMEOUT_MS = 4000;

const emptyNowPlaying = {
  isPlaying: false,
  title: '',
  artist: '',
  albumImageUrl: '',
  progressMs: 0,
  durationMs: 0,
  spotifyUrl: '',
};

export type NowPlayingDto = typeof emptyNowPlaying;

export type RecentTrackDto = {
  title: string;
  artist: string;
  albumImageUrl: string;
  spotifyUrl: string;
  playedAt: string;
  playCount: number;
};

export type TopTrackDto = {
  title: string;
  artist: string;
  albumImageUrl: string;
  spotifyUrl: string;
  rank: number;
};

type TokenCache = { accessToken: string; expiresAt: number };

type CacheEntry<T> = { value: T; expiresAt: number };

@Injectable()
export class SpotifyService {
  private token: TokenCache | null = null;
  private nowPlayingCache: CacheEntry<NowPlayingDto> | null = null;
  private recentCache: CacheEntry<{ tracks: RecentTrackDto[] }> | null = null;
  private topCache: CacheEntry<{ tracks: TopTrackDto[] }> | null = null;

  constructor(private readonly config: ConfigService) {}

  async getNowPlaying(): Promise<NowPlayingDto> {
    const cached = this.readCache(this.nowPlayingCache);
    if (cached) return cached;

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return this.writeNowPlaying(emptyNowPlaying);
    }

    const response = await this.spotifyFetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      accessToken,
    );

    if (!response || response.status === 204 || response.status === 404) {
      return this.writeNowPlaying(emptyNowPlaying);
    }

    if (!response.ok) {
      return this.writeNowPlaying(emptyNowPlaying);
    }

    const data = (await response.json()) as {
      is_playing: boolean;
      progress_ms: number;
      item: {
        name: string;
        duration_ms: number;
        artists: Array<{ name: string }>;
        album: { images: Array<{ url: string }> };
        external_urls: { spotify: string };
      } | null;
    };

    if (!data.item || !data.is_playing) {
      return this.writeNowPlaying(emptyNowPlaying);
    }

    return this.writeNowPlaying({
      isPlaying: true,
      title: data.item.name,
      artist: data.item.artists.map((artist) => artist.name).join(', '),
      albumImageUrl: data.item.album.images[0]?.url || '',
      progressMs: data.progress_ms || 0,
      durationMs: data.item.duration_ms,
      spotifyUrl: data.item.external_urls.spotify,
    });
  }

  async getRecentlyPlayed(): Promise<{ tracks: RecentTrackDto[] }> {
    const cached = this.readCache(this.recentCache);
    if (cached) return cached;

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return this.writeRecent({ tracks: [] });
    }

    const response = await this.spotifyFetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=20',
      accessToken,
    );

    if (!response?.ok) {
      return this.writeRecent({ tracks: [] });
    }

    const data = (await response.json()) as {
      items: Array<{
        played_at: string;
        track: {
          name: string;
          artists: Array<{ name: string }>;
          album: { images: Array<{ url: string }> };
          external_urls: { spotify: string };
        };
      }>;
    };

    const grouped = new Map<string, RecentTrackDto>();
    for (const { track, played_at } of data.items ?? []) {
      const spotifyUrl = track.external_urls.spotify;
      const existing = grouped.get(spotifyUrl);
      if (existing) {
        existing.playCount += 1;
        continue;
      }
      grouped.set(spotifyUrl, {
        title: track.name,
        artist: track.artists.map((artist) => artist.name).join(', '),
        albumImageUrl: track.album.images[0]?.url || '',
        spotifyUrl,
        playedAt: played_at,
        playCount: 1,
      });
    }

    return this.writeRecent({ tracks: Array.from(grouped.values()) });
  }

  async getTopTracks(): Promise<{ tracks: TopTrackDto[] }> {
    const cached = this.readCache(this.topCache);
    if (cached) return cached;

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return this.writeTop({ tracks: [] });
    }

    const response = await this.spotifyFetch(
      'https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=20',
      accessToken,
    );

    if (!response?.ok) {
      return this.writeTop({ tracks: [] });
    }

    const data = (await response.json()) as {
      items: Array<{
        name: string;
        artists: Array<{ name: string }>;
        album: { images: Array<{ url: string }> };
        external_urls: { spotify: string };
      }>;
    };

    const tracks = (data.items ?? []).map((track, index) => ({
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      albumImageUrl: track.album.images[0]?.url || '',
      spotifyUrl: track.external_urls.spotify,
      rank: index + 1,
    }));

    return this.writeTop({ tracks }, 60 * 60 * 1000);
  }

  private writeNowPlaying(value: NowPlayingDto) {
    this.nowPlayingCache = { value, expiresAt: Date.now() + 10_000 };
    return value;
  }

  private writeRecent(value: { tracks: RecentTrackDto[] }) {
    this.recentCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  }

  private writeTop(value: { tracks: TopTrackDto[] }, ttl = 30_000) {
    this.topCache = { value, expiresAt: Date.now() + ttl };
    return value;
  }

  private readCache<T>(entry: CacheEntry<T> | null): T | null {
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.value;
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.accessToken;
    }

    const clientId = this.config.get<string>('spotify.clientId') ?? '';
    const clientSecret = this.config.get<string>('spotify.clientSecret') ?? '';
    const refreshToken = this.config.get<string>('spotify.refreshToken') ?? '';

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(SPOTIFY_TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      this.token = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      return this.token.accessToken;
    } catch {
      return null;
    }
  }

  private async spotifyFetch(url: string, accessToken: string) {
    try {
      return await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(SPOTIFY_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  }
}
