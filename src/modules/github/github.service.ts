import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPHQL = 'https://api.github.com/graphql';
const CACHE_MS = 10 * 60 * 1000;

const LEVELS = [
  'NONE',
  'FIRST_QUARTILE',
  'SECOND_QUARTILE',
  'THIRD_QUARTILE',
  'FOURTH_QUARTILE',
] as const;

export type ContributionDay = {
  date: string;
  count: number;
  level: number;
};

type Calendar = {
  year: number;
  total: number | null;
  days: ContributionDay[];
};

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private cache: { value: Calendar; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async contributions(year = new Date().getFullYear()): Promise<Calendar> {
    if (
      this.cache &&
      this.cache.value.year === year &&
      this.cache.expiresAt > Date.now()
    ) {
      return this.cache.value;
    }

    const token = this.config.get<string>('github.token') ?? '';
    const login = this.config.get<string>('github.login') ?? 'ttiziu';
    const empty: Calendar = { year, total: null, days: [] };
    if (!token) return empty;

    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    try {
      const response = await fetch(GRAPHQL, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query ($login: String!, $from: DateTime!, $to: DateTime!) {
            user(login: $login) {
              contributionsCollection(from: $from, to: $to) {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      date
                      contributionCount
                      contributionLevel
                    }
                  }
                }
              }
            }
          }`,
          variables: { login, from, to },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        this.logger.error(`GitHub GraphQL ${response.status}`);
        return empty;
      }

      const payload = (await response.json()) as {
        errors?: unknown;
        data?: {
          user?: {
            contributionsCollection?: {
              contributionCalendar?: {
                totalContributions?: number;
                weeks?: {
                  contributionDays?: {
                    date: string;
                    contributionCount: number;
                    contributionLevel: string;
                  }[];
                }[];
              };
            };
          };
        };
      };

      if (payload.errors) {
        this.logger.error('GitHub GraphQL errors');
        return empty;
      }

      const calendar =
        payload.data?.user?.contributionsCollection?.contributionCalendar;
      const days = (calendar?.weeks ?? []).flatMap((week) =>
        (week.contributionDays ?? []).map((day) => ({
          date: day.date,
          count: day.contributionCount,
          level: Math.max(0, LEVELS.indexOf(day.contributionLevel as (typeof LEVELS)[number])),
        })),
      );

      const value: Calendar = {
        year,
        total: calendar?.totalContributions ?? null,
        days,
      };
      this.cache = { value, expiresAt: Date.now() + CACHE_MS };
      return value;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'GitHub request failed',
      );
      return empty;
    }
  }
}
