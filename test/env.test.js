'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProviderEnv,
  buildDefaultEnv,
  ZAI_BASE_URL,
  MINIMAX_BASE_URL,
  OLLAMA_BASE_URL,
  PROFILES,
} = require('../src/env');

test('buildProviderEnv sets required Z.AI variables and does not mutate base env', () => {
  const baseEnv = {
    PATH: '/tmp',
    ZAI_API_KEY: 'zai-secret',
    ANTHROPIC_API_KEY: 'should-clear',
    ANTHROPIC_AUTH_TOKEN: 'old-token',
    ANTHROPIC_BASE_URL: 'https://example.com',
  };

  const result = buildProviderEnv(baseEnv, 'ZAI', { profile: PROFILES.MINIMAL });

  assert.equal(result.ok, true);
  assert.equal(result.env.ANTHROPIC_BASE_URL, ZAI_BASE_URL);
  assert.equal(result.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(result.env.ANTHROPIC_API_KEY, '');
  assert.equal(baseEnv.ANTHROPIC_API_KEY, 'should-clear');
});

test('buildProviderEnv sets required MiniMax variables and does not mutate base env', () => {
  const baseEnv = {
    PATH: '/tmp',
    MINIMAX_API_KEY: 'minimax-secret',
    ANTHROPIC_API_KEY: 'should-clear',
    ANTHROPIC_AUTH_TOKEN: 'old-token',
    ANTHROPIC_BASE_URL: 'https://example.com',
  };

  const result = buildProviderEnv(baseEnv, 'MINIMAX', { profile: PROFILES.MINIMAL });

  assert.equal(result.ok, true);
  assert.equal(result.env.ANTHROPIC_BASE_URL, MINIMAX_BASE_URL);
  assert.equal(result.env.ANTHROPIC_AUTH_TOKEN, 'minimax-secret');
  assert.equal(result.env.ANTHROPIC_API_KEY, '');
});

test('buildProviderEnv uses ollama fallback token when OLLAMA_API_KEY is not set', () => {
  const baseEnv = {};

  const result = buildProviderEnv(baseEnv, 'OLLAMA', { profile: PROFILES.MINIMAL });

  assert.equal(result.ok, true);
  assert.equal(result.env.ANTHROPIC_BASE_URL, OLLAMA_BASE_URL);
  assert.equal(result.env.ANTHROPIC_AUTH_TOKEN, 'ollama');
  assert.equal(result.env.ANTHROPIC_API_KEY, '');
});

test('buildProviderEnv trims provider credential values before injection', () => {
  const baseEnv = {
    ZAI_API_KEY: '  zai-secret  ',
  };

  const result = buildProviderEnv(baseEnv, 'ZAI', { profile: PROFILES.MINIMAL });
  assert.equal(result.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
});

test('buildProviderEnv applies strict model map for Z.AI', () => {
  const baseEnv = {
    ZAI_API_KEY: 'zai-secret',
  };

  const result = buildProviderEnv(baseEnv, 'ZAI', { profile: PROFILES.STRICT });

  assert.equal(result.ok, true);
  assert.equal(result.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'GLM-4.7');
  assert.equal(result.env.ANTHROPIC_SMALL_FAST_MODEL, 'GLM-4.5-Air');
});

test('buildProviderEnv applies strict model map for Ollama only when OLLAMA_MODEL is set', () => {
  const withModel = buildProviderEnv({ OLLAMA_MODEL: 'qwen2.5-coder' }, 'OLLAMA', { profile: PROFILES.STRICT });
  assert.equal(withModel.ok, true);
  assert.equal(withModel.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'qwen2.5-coder');

  const withoutModel = buildProviderEnv({}, 'OLLAMA', { profile: PROFILES.STRICT });
  assert.equal(withoutModel.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(withoutModel.env, 'ANTHROPIC_DEFAULT_OPUS_MODEL'), false);
});

test('buildProviderEnv fails when provider base URL override is invalid', () => {
  const result = buildProviderEnv({ ZAI_API_KEY: 'x', ZAI_BASE_URL: 'not-a-url' }, 'ZAI', { profile: PROFILES.MINIMAL });
  assert.equal(result.ok, false);
  assert.match(result.error, /ZAI_BASE_URL/);
});

test('buildDefaultEnv unsets anthropic runtime override variables and model map vars', () => {
  const baseEnv = {
    PATH: '/tmp',
    ZAI_API_KEY: 'zai-secret',
    MINIMAX_API_KEY: 'minimax-secret',
    OLLAMA_API_KEY: 'ollama-secret',
    ANTHROPIC_API_KEY: 'set',
    ANTHROPIC_AUTH_TOKEN: 'set',
    ANTHROPIC_BASE_URL: 'set',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'model-x',
  };

  const nextEnv = buildDefaultEnv(baseEnv);

  assert.equal(nextEnv.ZAI_API_KEY, 'zai-secret');
  assert.equal(nextEnv.MINIMAX_API_KEY, 'minimax-secret');
  assert.equal(nextEnv.OLLAMA_API_KEY, 'ollama-secret');
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_API_KEY'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_AUTH_TOKEN'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_BASE_URL'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_DEFAULT_OPUS_MODEL'), false);
});
