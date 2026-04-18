'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { collectDiagnostics, detectProvider } = require('../src/diagnostics');
const { ZAI_BASE_URL, MINIMAX_BASE_URL } = require('../src/env');

test('detectProvider returns Z.AI when z.ai base URL is configured', () => {
  const provider = detectProvider({
    ANTHROPIC_BASE_URL: ZAI_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: 'token',
    ANTHROPIC_API_KEY: '',
  });

  assert.equal(provider, 'Z.AI');
});

test('detectProvider returns MiniMax when minimax base URL is configured', () => {
  const provider = detectProvider({
    ANTHROPIC_BASE_URL: MINIMAX_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: 'token',
    ANTHROPIC_API_KEY: '',
  });

  assert.equal(provider, 'MiniMax');
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
