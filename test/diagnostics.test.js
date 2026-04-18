'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { collectDiagnostics, detectProvider } = require('../src/diagnostics');
const { ZAI_BASE_URL, MINIMAX_BASE_URL, OLLAMA_BASE_URL } = require('../src/env');

test('detectProvider resolves by known base URLs', () => {
  assert.equal(detectProvider({ ANTHROPIC_BASE_URL: ZAI_BASE_URL }), 'Z.AI');
  assert.equal(detectProvider({ ANTHROPIC_BASE_URL: MINIMAX_BASE_URL }), 'MiniMax');
  assert.equal(detectProvider({ ANTHROPIC_BASE_URL: OLLAMA_BASE_URL }), 'Ollama');
  assert.equal(detectProvider({}), 'Claude');
});

test('collectDiagnostics reports conflicts when API key and auth token are both set', () => {
  const diag = collectDiagnostics({
    ANTHROPIC_API_KEY: 'key',
    ANTHROPIC_AUTH_TOKEN: 'token',
    ANTHROPIC_BASE_URL: ZAI_BASE_URL,
  });

  assert.equal(diag.provider, 'Z.AI');
  assert.equal(diag.anthropicApiKey, 'detected');
  assert.equal(diag.anthropicAuthToken, 'detected');
  assert.equal(diag.anthropicBaseUrl, 'set');
  assert.equal(diag.baseUrlHost, 'api.z.ai');
  assert.ok(diag.warnings.some((w) => w.includes('globally set')));
  assert.ok(diag.warnings.some((w) => w.includes('Conflicting auth')));
});

test('collectDiagnostics warns when MiniMax endpoint is configured without MINIMAX_API_KEY', () => {
  const diag = collectDiagnostics({
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: 'token',
    ANTHROPIC_BASE_URL: MINIMAX_BASE_URL,
    MINIMAX_API_KEY: '',
  });

  assert.equal(diag.provider, 'MiniMax');
  assert.ok(diag.warnings.some((w) => w.includes('MINIMAX_API_KEY')));
});

test('collectDiagnostics reports profile and model map summary', () => {
  const diag = collectDiagnostics({
    CLAUDE_SWITCH_PROFILE: 'strict',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'GLM-4.7',
  });

  assert.equal(diag.profile, 'strict');
  assert.equal(diag.modelMap.ANTHROPIC_DEFAULT_OPUS_MODEL, 'GLM-4.7');
});
