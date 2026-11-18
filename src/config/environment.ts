export function validateEnvironment(config: Record<string, unknown>) {
  const required = [
    'MONGO_URI',
    'ACCESS_TOKEN_USER',
    'ACCESS_TOKEN_ADMIN',
    'REFRESH_TOKEN_USER',
    'REFRESH_TOKEN_ADMIN',
    'BEARER_USER',
    'BEARER_ADMIN',
  ];
  for (const key of required)
    if (typeof config[key] !== 'string' || !config[key])
      throw new Error(`Missing configuration: ${key}`);
  const secrets = required.slice(1, 5).map((key) => config[key] as string);
  if (secrets.some((value) => value.length < 32) || new Set(secrets).size !== 4)
    throw new Error(
      'Provide four distinct token secrets of at least 32 characters',
    );
  if (config.BEARER_USER === config.BEARER_ADMIN)
    throw new Error('User and admin authorization prefixes must differ');
  return config;
}
