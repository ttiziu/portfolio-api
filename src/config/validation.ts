export function validateEnv(config: Record<string, unknown>) {
  const port = config.PORT;
  if (port !== undefined && port !== '' && Number.isNaN(Number(port))) {
    throw new Error('PORT must be a number');
  }

  return config;
}
