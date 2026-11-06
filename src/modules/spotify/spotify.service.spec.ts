import { ConfigService } from '@nestjs/config';
import { SpotifyService } from './spotify.service';

describe('Spotify token refresh', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function service() {
    return new SpotifyService(
      new ConfigService({
        spotify: {
          clientId: 'test',
          clientSecret: 'test',
          refreshToken: 'test',
        },
      }),
    );
  }

  it('shares one refresh across simultaneous music requests', async () => {
    let refreshes = 0;
    global.fetch = jest.fn(async (url) => {
      await Promise.resolve();
      if (typeof url === 'string' && url.includes('/api/token')) {
        refreshes++;
        return Response.json({ access_token: 'test-token', expires_in: 3600 });
      }
      return Response.json({ items: [], item: null, is_playing: false });
    });
    const spotify = service();
    await Promise.all([
      spotify.getNowPlaying(),
      spotify.getRecentlyPlayed(),
      spotify.getTopTracks(),
    ]);
    expect(refreshes).toBe(1);
  });

  it('allows another refresh after a failed request', async () => {
    let refreshes = 0;
    global.fetch = jest.fn(async (url) => {
      await Promise.resolve();
      if (typeof url === 'string' && url.includes('/api/token')) {
        refreshes++;
        if (refreshes === 1) throw new Error('Temporary failure');
        return Response.json({ access_token: 'test-token', expires_in: 3600 });
      }
      return Response.json({ items: [] });
    });
    const spotify = service();
    await spotify.getNowPlaying();
    await spotify.getTopTracks();
    expect(refreshes).toBe(2);
  });
});
