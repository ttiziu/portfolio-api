import { Controller, Get } from '@nestjs/common';
import { SpotifyService } from './spotify.service';

@Controller('spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Get('now-playing')
  nowPlaying() {
    return this.spotifyService.getNowPlaying();
  }

  @Get('recently-played')
  recentlyPlayed() {
    return this.spotifyService.getRecentlyPlayed();
  }

  @Get('top-tracks')
  topTracks() {
    return this.spotifyService.getTopTracks();
  }
}
