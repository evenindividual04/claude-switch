'use strict';

const { MODEL_ENV_KEYS, PROFILES, PROVIDERS, normalizeProfile, normalizeUrl, readTrimmedEnvVar } = require('./env');

function hasValue(value) {
  return typeof value === 'string' && value.length > 0;
}

function getBaseUrlHost(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    return parsed.host;
  } catch {
    return 'unknown';
  }
}

function detectProvider(env) {
  const baseUrl = normalizeUrl(env.ANTHROPIC_BASE_URL || '');

  if (!baseUrl) {
    return PROVIDERS.CLAUDE.label;
  }

  if (baseUrl === normalizeUrl(PROVIDERS.ZAI.baseUrl) || baseUrl.includes('api.z.ai')) {
    return PROVIDERS.ZAI.label;
  }

  if (baseUrl === normalizeUrl(PROVIDERS.MINIMAX.baseUrl) || baseUrl.includes('api.minimax.io')) {
    return PROVIDERS.MINIMAX.label;
  }

  if (baseUrl === normalizeUrl(PROVIDERS.OLLAMA.baseUrl) || baseUrl.includes('localhost:11434')) {
    return PROVIDERS.OLLAMA.label;
  }

  return 'Custom';
}

function summarizeModelMap(env) {
  const mapping = {};

  for (const key of MODEL_ENV_KEYS) {
    if (hasValue(env[key])) {
      mapping[key] = env[key];
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : null;
}

function collectDiagnostics(env) {
  const apiKeyDetected = hasValue(env.ANTHROPIC_API_KEY);
  const authTokenDetected = hasValue(env.ANTHROPIC_AUTH_TOKEN);
  const baseUrlSet = hasValue(env.ANTHROPIC_BASE_URL);
  const baseUrl = normalizeUrl(env.ANTHROPIC_BASE_URL || '');

  const zaiKeyDetected = hasValue(env.ZAI_API_KEY);
  const minimaxKeyDetected = hasValue(env.MINIMAX_API_KEY);
  const ollamaKeyDetected = hasValue(env.OLLAMA_API_KEY);

  const warnings = [];

  if (apiKeyDetected) {
    warnings.push('ANTHROPIC_API_KEY is globally set and overrides token-based auth.');
  }

  if (apiKeyDetected && authTokenDetected) {
    warnings.push('Conflicting auth detected: both ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN are set.');
  }

  if (baseUrlSet && !authTokenDetected) {
    warnings.push('ANTHROPIC_BASE_URL is set without ANTHROPIC_AUTH_TOKEN.');
  }

  if (baseUrlSet && apiKeyDetected) {
    warnings.push('ANTHROPIC_BASE_URL is set while ANTHROPIC_API_KEY is non-empty; API key takes precedence.');
  }

  if ((baseUrl.includes('api.z.ai') || baseUrl === normalizeUrl(PROVIDERS.ZAI.baseUrl)) && !zaiKeyDetected) {
    warnings.push('Z.AI endpoint detected but ZAI_API_KEY is missing or empty.');
  }

  if ((baseUrl.includes('api.minimax.io') || baseUrl === normalizeUrl(PROVIDERS.MINIMAX.baseUrl)) && !minimaxKeyDetected) {
    warnings.push('MiniMax endpoint detected but MINIMAX_API_KEY is missing or empty.');
  }

  if ((baseUrl.includes('localhost:11434') || baseUrl === normalizeUrl(PROVIDERS.OLLAMA.baseUrl)) && !ollamaKeyDetected) {
    warnings.push('OLLAMA_API_KEY is not set; falling back to token "ollama".');
  }

  const profile = normalizeProfile(readTrimmedEnvVar(env, 'CLAUDE_SWITCH_PROFILE') || PROFILES.MINIMAL);

  return {
    provider: detectProvider(env),
    anthropicApiKey: apiKeyDetected ? 'detected' : 'empty',
    anthropicAuthToken: authTokenDetected ? 'detected' : 'missing',
    anthropicBaseUrl: baseUrlSet ? 'set' : 'unset',
    baseUrlHost: baseUrlSet ? getBaseUrlHost(baseUrl) : 'n/a',
    profile,
    modelMap: summarizeModelMap(env),
    zaiApiKey: zaiKeyDetected ? 'detected' : 'missing',
    minimaxApiKey: minimaxKeyDetected ? 'detected' : 'missing',
    ollamaApiKey: ollamaKeyDetected ? 'detected' : 'missing',
    warnings,
  };
}

function printStatus(diag, logger) {
  console.log(`Provider: ${diag.provider}`);
  console.log(`ANTHROPIC_API_KEY: ${diag.anthropicApiKey}`);
  console.log(`ANTHROPIC_AUTH_TOKEN: ${diag.anthropicAuthToken}`);
  console.log(`ANTHROPIC_BASE_URL: ${diag.anthropicBaseUrl}`);
  console.log(`Base Host: ${diag.baseUrlHost}`);
  console.log(`Profile: ${diag.profile}`);
  console.log(`ZAI_API_KEY: ${diag.zaiApiKey}`);
  console.log(`MINIMAX_API_KEY: ${diag.minimaxApiKey}`);
  console.log(`OLLAMA_API_KEY: ${diag.ollamaApiKey}`);

  if (diag.modelMap) {
    console.log('Model Mapping:');
    for (const key of Object.keys(diag.modelMap)) {
      console.log(`  ${key}=${diag.modelMap[key]}`);
    }
  } else {
    console.log('Model Mapping: none');
  }

  for (const warning of diag.warnings) {
    logger.warn(warning);
  }
}

function redactValue(value) {
  if (!hasValue(value)) {
    return null;
  }

  if (value.length <= 8) {
    return `${value[0]}***(${value.length})`;
  }

  return `${value.slice(0, 4)}...${value.slice(-2)}(${value.length})`;
}

function redactEnvDelta(envDelta) {
  const redacted = {};

  for (const [key, value] of Object.entries(envDelta)) {
    if (key.endsWith('TOKEN') || key.endsWith('KEY')) {
      redacted[key] = redactValue(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

function printDebug(payload) {
  const safePayload = {
    provider: payload.provider,
    providerId: payload.providerId,
    detectedProvider: payload.detectedProvider,
    profile: payload.profile,
    argv: payload.argv,
    providerArgConsumed: payload.providerArgConsumed,
    selectorToken: payload.selectorToken,
    resolvedBinary: payload.resolvedBinary,
    candidates: payload.candidates,
    envDelta: redactEnvDelta(payload.envDelta || {}),
    anthropic: {
      baseUrl: payload.env.ANTHROPIC_BASE_URL || null,
      apiKey: redactValue(payload.env.ANTHROPIC_API_KEY || ''),
      authToken: redactValue(payload.env.ANTHROPIC_AUTH_TOKEN || ''),
    },
    zaiApiKey: redactValue(payload.env.ZAI_API_KEY || ''),
    minimaxApiKey: redactValue(payload.env.MINIMAX_API_KEY || ''),
    ollamaApiKey: redactValue(payload.env.OLLAMA_API_KEY || ''),
  };

  console.log(JSON.stringify(safePayload, null, 2));
}

module.exports = {
  detectProvider,
  collectDiagnostics,
  printStatus,
  printDebug,
};
