import { ConfigService } from '@nestjs/config';
import { GithubService } from './github.service';

describe('GitHub contribution cache', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shares simultaneous requests and retains each year independently', async () => {
    let requests = 0;
    global.fetch = jest.fn(async () => {
      await Promise.resolve();
      requests++;
      return Response.json({
        data: {
          user: {
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: 2,
                weeks: [
                  {
                    contributionDays: [
                      {
                        date: '2026-01-01',
                        contributionCount: 2,
                        contributionLevel: 'FIRST_QUARTILE',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      });
    });
    const github = new GithubService(
      new ConfigService({ github: { token: 'test', login: 'test' } }),
    );
    const [first, second] = await Promise.all([
      github.contributions(2026),
      github.contributions(2026),
    ]);
    expect(first).toEqual(second);
    expect(first.days[0].level).toBe(1);
    expect(requests).toBe(1);
    await github.contributions(2025);
    await github.contributions(2026);
    expect(requests).toBe(2);
  });
});
