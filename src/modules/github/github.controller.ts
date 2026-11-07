import { Controller, Get, Query } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Get('contributions')
  contributions(@Query('year') year?: string) {
    const parsed = Number(year);
    const current = new Date().getFullYear();
    const safe =
      Number.isInteger(parsed) && parsed >= 2008 && parsed <= current
        ? parsed
        : current;
    return this.github.contributions(safe);
  }
}
