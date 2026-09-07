export default () => ({
  port: parseInt(process.env.PORT ?? '7700', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN ?? '',
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN ?? '',
    userId: process.env.DISCORD_USER_ID ?? '',
  },
});
