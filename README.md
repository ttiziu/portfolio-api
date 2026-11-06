# Portfolio API

NestJS API for the portfolio's Spotify, Discord and contact integrations. Use Node.js 24 LTS (24.15 or later).

```sh
npm ci
npm run start:dev
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Copy `.env.example` to `.env` and supply credentials locally. Never put credentials in the frontend or commit `.env`.

## Responsibilities

- Controllers handle HTTP endpoints and delegate to services.
- Services own their integration behavior and external API calls.
- DTOs validate incoming contact data.
- `src/config` loads and validates environment settings.
- `src/common/filters` translates failures into HTTP responses.
- `src/main.ts` configures headers, CORS, validation and application startup.

Keep modules independent. Add abstraction boundaries when there is a real alternate implementation or testing need; no database, generic repositories or additional architecture framework is needed for these three integrations.

## Endpoints

- `GET /api/health`
- `GET /api/spotify/now-playing`
- `GET /api/spotify/recently-played`
- `GET /api/spotify/top-tracks`
- `GET /api/discord/avatar`
- `POST /api/contact`

The default port is 7700. Allowed frontend origins come from `CORS_ORIGINS`. Spotify, Discord and email credentials are described in `.env.example`.

## Upgrade notes

NestJS 12 packages are ESM. The application remains CommonJS, supported by the configured Node 24 runtime. Jest scripts enable VM modules to load these packages; Jest may print Node's experimental VM modules notice.

TypeScript stays on the latest compatible 6.0 patch line because the current lint and Jest transformers do not support TypeScript 7. Production dependencies pass `npm audit --omit=dev`; development tools still have upstream audit findings. Do not apply `npm audit fix --force`, which proposes incompatible downgrades.
