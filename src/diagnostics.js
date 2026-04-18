'use strict';

const { PROVIDERS } = require('./env');

function hasValue(value) {
  return typeof value === 'string' && value.length > 0;
}

function normalizeUrl(url) {
  if (!url) {
    return '';
  }

  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function detectProvider(env) {
  const baseUrl = normalizeUrl(env.ANTHROPIC_BASE_URL || '');

  if (baseUrl === normalizeUrl(PROVIDERS.ZAI.baseUrl)) {
    return PROVIDERS.ZAI.label;
  }

  if (baseUrl === normalizeUrl(PROVIDERS.MINIMAX.baseUrl)) {
    return PROVIDERS.MINIMAX.label;
  }

  return PROVIDERS.CLAUDE.label;
}

function collectDiagnostics(env) {
  const apiKeyDetected = hasValue(env.ANTHROPIC_API_KEY);
  const authTokenDetected = hasValue(env.ANTHROPIC_AUTH_TOKEN);
  const baseUrlSet = hasValue(env.ANTHROPIC_BASE_URL);
  const baseUrl = normalizeUrl(env.ANTHROPIC_BASE_URL || '');
  const zaiKeyDetected = hasValue(env.ZAI_API_KEY);
  const minimaxKeyDetected = hasValue(env.MINIMAX_API_KEY);

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

  if (baseUrl === normalizeUrl(PROVIDERS.ZAI.baseUrl) && !zaiKeyDetected) {
    warnings.push('Z.AI endpoint detected but ZAI_API_KEY is missing or empty.');
  }

  if (baseUrl === normalizeUrl(PROVIDERS.MINIMAX.baseUrl) && !minimaxKeyDetected) {
    warnings.push('MiniMax endpoint detected but MINIMAX_API_KEY is missing or empty.');
  }

  return {
    provider: detectProvider(env),
    anthropicApiKey: apiKeyDetected ? 'detected' : 'empty',
    anthropicAuthToken: authTokenDetected ? 'detected' : 'missing',
    anthropicBaseUrl: baseUrlSet ? 'set' : 'unset',
    zaiApiKey: zaiKeyDetected ? 'detected' : 'missing',
    minimaxApiKey: minimaxKeyDetected ? 'detected' : 'missing',
    warnings,
  };
}

function printStatus(diag, logger) {
  console.log(`Provider: ${diag.provider}`);
  console.log(`ANTHROPIC_API_KEY: ${diag.anthropicApiKey}`);
  console.log(`ANTHROPIC_AUTH_TOKEN: ${diag.anthropicAuthToken}`);
  console.log(`ANTHROPIC_BASE_URL: ${diag.anthropicBaseUrl}`);
  console.log(`ZAI_API_KEY: ${diag.zaiApiKey}`);
  console.log(`MINIMAX_API_KEY: ${diag.minimaxApiKey}`);

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

function printDebug(payload) {
  const safePayload = {
    provider: payload.provider,
    providerId: payload.providerId,
    detectedProvider: payload.detectedProvider,
    argv: payload.argv,
    providerArgConsumed: payload.providerArgConsumed,
    selectorToken: payload.selectorToken,
    resolvedBinary: payload.resolvedBinary,
    candidates: payload.candidates,
    anthropic: {
      baseUrl: payload.env.ANTHROPIC_BASE_URL || null,
      apiKey: redactValue(payload.env.ANTHROPIC_API_KEY || ''),
      authToken: redactValue(payload.env.ANTHROPIC_AUTH_TOKEN || ''),
    },
    zaiApiKey: redactValue(payload.env.ZAI_API_KEY || ''),
    minimaxApiKey: redactValue(payload.env.MINIMAX_API_KEY || ''),
  };

  console.log(JSON.stringify(safePayload, null, 2));
}

module.exports = {
  detectProvider,
  collectDiagnostics,
  printStatus,
  printDebug,
};
