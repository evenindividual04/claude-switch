'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProviderEnv,
  buildDefaultEnv,
  ZAI_BASE_URL,
  MINIMAX_BASE_URL,
} = require('../src/env');

test('buildProviderEnv sets required Z.AI variables and does not mutate base env', () => {
  const baseEnv = {
    PATH: '/tmp',
    ZAI_API_KEY: 'zai-secret',
    ANTHROPIC_API_KEY: 'should-clear',
    ANTHROPIC_AUTH_TOKEN: 'old-token',
    ANTHROPIC_BASE_URL: 'https://example.com',
  };

  const nextEnv = buildProviderEnv(baseEnv, 'ZAI');

  assert.notEqual(nextEnv, baseEnv);
  assert.equal(nextEnv.ANTHROPIC_BASE_URL, ZAI_BASE_URL);
  assert.equal(nextEnv.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(nextEnv.ANTHROPIC_API_KEY, '');

  assert.equal(baseEnv.ANTHROPIC_API_KEY, 'should-clear');
  assert.equal(baseEnv.ANTHROPIC_AUTH_TOKEN, 'old-token');
  assert.equal(baseEnv.ANTHROPIC_BASE_URL, 'https://example.com');
});

test('buildProviderEnv sets required MiniMax variables and does not mutate base env', () => {
  const baseEnv = {
    PATH: '/tmp',
    MINIMAX_API_KEY: 'minimax-secret',
    ANTHROPIC_API_KEY: 'should-clear',
    ANTHROPIC_AUTH_TOKEN: 'old-token',
    ANTHROPIC_BASE_URL: 'https://example.com',
  };

  const nextEnv = buildProviderEnv(baseEnv, 'MINIMAX');

  assert.notEqual(nextEnv, baseEnv);
  assert.equal(nextEnv.ANTHROPIC_BASE_URL, MINIMAX_BASE_URL);
  assert.equal(nextEnv.ANTHROPIC_AUTH_TOKEN, 'minimax-secret');
  assert.equal(nextEnv.ANTHROPIC_API_KEY, '');

  assert.equal(baseEnv.ANTHROPIC_API_KEY, 'should-clear');
  assert.equal(baseEnv.ANTHROPIC_AUTH_TOKEN, 'old-token');
  assert.equal(baseEnv.ANTHROPIC_BASE_URL, 'https://example.com');
});

test('buildProviderEnv trims provider credential values before injection', () => {
  const baseEnv = {
    ZAI_API_KEY: '  zai-secret  ',
  };

  const nextEnv = buildProviderEnv(baseEnv, 'ZAI');
  assert.equal(nextEnv.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
});

test('buildDefaultEnv unsets anthropic runtime override variables only', () => {
  const baseEnv = {
    PATH: '/tmp',
    ZAI_API_KEY: 'zai-secret',
    MINIMAX_API_KEY: 'minimax-secret',
    ANTHROPIC_API_KEY: 'set',
    ANTHROPIC_AUTH_TOKEN: 'set',
    ANTHROPIC_BASE_URL: 'set',
  };

  const nextEnv = buildDefaultEnv(baseEnv);

  assert.notEqual(nextEnv, baseEnv);
  assert.equal(nextEnv.ZAI_API_KEY, 'zai-secret');
  assert.equal(nextEnv.MINIMAX_API_KEY, 'minimax-secret');
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_API_KEY'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_AUTH_TOKEN'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(nextEnv, 'ANTHROPIC_BASE_URL'), false);

  assert.equal(baseEnv.ANTHROPIC_API_KEY, 'set');
});
