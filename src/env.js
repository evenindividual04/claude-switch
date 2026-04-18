'use strict';

const ZAI_BASE_URL = 'https://api.z.ai/api/anthropic';
const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';

const PROVIDERS = {
  CLAUDE: {
    id: 'CLAUDE',
    label: 'Claude',
    selectorTokens: [],
    credentialEnvVar: null,
    baseUrl: null,
  },
  ZAI: {
    id: 'ZAI',
    label: 'Z.AI',
    selectorTokens: ['z.ai', 'zai'],
    credentialEnvVar: 'ZAI_API_KEY',
    baseUrl: ZAI_BASE_URL,
  },
  MINIMAX: {
    id: 'MINIMAX',
    label: 'MiniMax',
    selectorTokens: ['minimax'],
    credentialEnvVar: 'MINIMAX_API_KEY',
    baseUrl: MINIMAX_BASE_URL,
  },
};

const TOKEN_TO_PROVIDER_ID = new Map();
for (const provider of Object.values(PROVIDERS)) {
  for (const token of provider.selectorTokens) {
    TOKEN_TO_PROVIDER_ID.set(token.toLowerCase(), provider.id);
  }
}

function buildDefaultEnv(baseEnv) {
  const env = { ...baseEnv };

  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;

  return env;
}

function buildProviderEnv(baseEnv, providerId) {
  const provider = PROVIDERS[providerId] || PROVIDERS.CLAUDE;

  if (provider.id === PROVIDERS.CLAUDE.id) {
    return buildDefaultEnv(baseEnv);
  }

  const env = { ...baseEnv };
  const tokenVar = provider.credentialEnvVar;
  const tokenValue = tokenVar && typeof baseEnv[tokenVar] === 'string'
    ? baseEnv[tokenVar].trim()
    : '';

  env.ANTHROPIC_BASE_URL = provider.baseUrl;
  env.ANTHROPIC_AUTH_TOKEN = tokenValue;
  env.ANTHROPIC_API_KEY = '';

  return env;
}

function getProviderById(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.CLAUDE;
}

function getProviderByToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }

  const providerId = TOKEN_TO_PROVIDER_ID.get(token.toLowerCase());
  return providerId ? PROVIDERS[providerId] : null;
}

function listSelectableProviders() {
  return Object.values(PROVIDERS).filter((provider) => provider.selectorTokens.length > 0);
}

module.exports = {
  PROVIDERS,
  ZAI_BASE_URL,
  MINIMAX_BASE_URL,
  buildProviderEnv,
  buildDefaultEnv,
  getProviderById,
  getProviderByToken,
  listSelectableProviders,
};
