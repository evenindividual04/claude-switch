'use strict';

const ZAI_BASE_URL = 'https://api.z.ai/api/anthropic';
const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';
const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_ENV_KEYS = [
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
];

const PROFILES = {
  MINIMAL: 'minimal',
  STRICT: 'strict',
};

const PROVIDERS = {
  CLAUDE: {
    id: 'CLAUDE',
    label: 'Claude',
    selectorTokens: [],
    credentialEnvVar: null,
    requireCredential: false,
    tokenFallback: null,
    baseUrl: null,
    baseUrlEnvVar: null,
    strictModelMap: null,
  },
  ZAI: {
    id: 'ZAI',
    label: 'Z.AI',
    selectorTokens: ['z.ai', 'zai'],
    credentialEnvVar: 'ZAI_API_KEY',
    requireCredential: true,
    tokenFallback: null,
    baseUrl: ZAI_BASE_URL,
    baseUrlEnvVar: 'ZAI_BASE_URL',
    strictModelMap: {
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'GLM-4.7',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'GLM-4.7',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'GLM-4.5-Air',
      ANTHROPIC_SMALL_FAST_MODEL: 'GLM-4.5-Air',
    },
  },
  MINIMAX: {
    id: 'MINIMAX',
    label: 'MiniMax',
    selectorTokens: ['minimax'],
    credentialEnvVar: 'MINIMAX_API_KEY',
    requireCredential: true,
    tokenFallback: null,
    baseUrl: MINIMAX_BASE_URL,
    baseUrlEnvVar: 'MINIMAX_BASE_URL',
    strictModelMap: {
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.1',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.1',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.1',
      ANTHROPIC_SMALL_FAST_MODEL: 'MiniMax-M2.1',
    },
  },
  OLLAMA: {
    id: 'OLLAMA',
    label: 'Ollama',
    selectorTokens: ['ollama'],
    credentialEnvVar: 'OLLAMA_API_KEY',
    requireCredential: false,
    tokenFallback: 'ollama',
    baseUrl: OLLAMA_BASE_URL,
    baseUrlEnvVar: 'OLLAMA_BASE_URL',
    strictModelMap: null,
  },
};

const TOKEN_TO_PROVIDER_ID = new Map();
for (const provider of Object.values(PROVIDERS)) {
  for (const token of provider.selectorTokens) {
    TOKEN_TO_PROVIDER_ID.set(token.toLowerCase(), provider.id);
  }
}

function readTrimmedEnvVar(baseEnv, name) {
  if (!name) {
    return '';
  }

  return typeof baseEnv[name] === 'string' ? baseEnv[name].trim() : '';
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isValidBaseUrl(urlValue) {
  const parsed = parseUrl(urlValue);
  if (!parsed) {
    return false;
  }

  return parsed.protocol === 'https:' || parsed.protocol === 'http:';
}

function normalizeProfile(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === PROFILES.STRICT) {
    return PROFILES.STRICT;
  }

  return PROFILES.MINIMAL;
}

function clearAnthropicRoutingEnv(env) {
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;
}

function clearModelEnv(env) {
  for (const key of MODEL_ENV_KEYS) {
    delete env[key];
  }
}

function resolveProviderBaseUrl(baseEnv, provider) {
  if (!provider.baseUrl) {
    return {
      ok: true,
      value: null,
      source: 'default',
      error: null,
    };
  }

  const override = readTrimmedEnvVar(baseEnv, provider.baseUrlEnvVar);
  if (!override) {
    return {
      ok: true,
      value: provider.baseUrl,
      source: 'default',
      error: null,
    };
  }

  if (!isValidBaseUrl(override)) {
    return {
      ok: false,
      value: null,
      source: 'override',
      error: `${provider.baseUrlEnvVar} must be a valid http(s) URL.`,
    };
  }

  return {
    ok: true,
    value: normalizeUrl(override),
    source: 'override',
    error: null,
  };
}

function resolveProviderToken(baseEnv, provider) {
  if (!provider.credentialEnvVar) {
    return '';
  }

  const value = readTrimmedEnvVar(baseEnv, provider.credentialEnvVar);
  if (value) {
    return value;
  }

  return provider.tokenFallback || '';
}

function resolveStrictModelMap(baseEnv, provider) {
  if (provider.id === 'OLLAMA') {
    const ollamaModel = readTrimmedEnvVar(baseEnv, 'OLLAMA_MODEL');
    if (!ollamaModel) {
      return null;
    }

    return {
      ANTHROPIC_DEFAULT_OPUS_MODEL: ollamaModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: ollamaModel,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: ollamaModel,
      ANTHROPIC_SMALL_FAST_MODEL: ollamaModel,
    };
  }

  return provider.strictModelMap || null;
}

function buildDefaultEnv(baseEnv) {
  const env = { ...baseEnv };
  clearAnthropicRoutingEnv(env);
  clearModelEnv(env);
  return env;
}

function buildProviderEnv(baseEnv, providerId, options = {}) {
  const provider = PROVIDERS[providerId] || PROVIDERS.CLAUDE;
  const profile = normalizeProfile(options.profile || PROFILES.MINIMAL);

  if (provider.id === PROVIDERS.CLAUDE.id) {
    return {
      ok: true,
      env: buildDefaultEnv(baseEnv),
      provider,
      profile,
      baseUrl: null,
      token: '',
      modelMap: null,
      error: null,
    };
  }

  const baseUrlResult = resolveProviderBaseUrl(baseEnv, provider);
  if (!baseUrlResult.ok) {
    return {
      ok: false,
      env: null,
      provider,
      profile,
      baseUrl: null,
      token: '',
      modelMap: null,
      error: baseUrlResult.error,
    };
  }

  const env = { ...baseEnv };
  clearModelEnv(env);

  const token = resolveProviderToken(baseEnv, provider);
  env.ANTHROPIC_BASE_URL = baseUrlResult.value;
  env.ANTHROPIC_AUTH_TOKEN = token;
  env.ANTHROPIC_API_KEY = '';

  let modelMap = null;
  if (profile === PROFILES.STRICT) {
    modelMap = resolveStrictModelMap(baseEnv, provider);
    if (modelMap) {
      Object.assign(env, modelMap);
    }
  }

  return {
    ok: true,
    env,
    provider,
    profile,
    baseUrl: baseUrlResult.value,
    token,
    modelMap,
    error: null,
  };
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

function listSupportedCommands() {
  return ['run', 'status', 'debug', 'doctor', 'probe', 'cache', 'completion', 'help'];
}

module.exports = {
  PROVIDERS,
  PROFILES,
  MODEL_ENV_KEYS,
  ZAI_BASE_URL,
  MINIMAX_BASE_URL,
  OLLAMA_BASE_URL,
  normalizeProfile,
  normalizeUrl,
  readTrimmedEnvVar,
  buildProviderEnv,
  buildDefaultEnv,
  getProviderById,
  getProviderByToken,
  listSelectableProviders,
  listSupportedCommands,
  resolveProviderBaseUrl,
};
