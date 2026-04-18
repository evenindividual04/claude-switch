'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectRunModeArgs, parseProfile } = require('../src/router');

test('detectRunModeArgs routes to ZAI when first arg is z.ai', () => {
  const result = detectRunModeArgs(['z.ai', '--model', 'x']);
  assert.equal(result.providerId, 'ZAI');
  assert.deepEqual(result.claudeArgs, ['--model', 'x']);
});

test('detectRunModeArgs routes to MiniMax when first arg is minimax', () => {
  const result = detectRunModeArgs(['minimax', '--model', 'x']);
  assert.equal(result.providerId, 'MINIMAX');
  assert.deepEqual(result.claudeArgs, ['--model', 'x']);
});

test('detectRunModeArgs routes to Ollama when first arg is ollama', () => {
  const result = detectRunModeArgs(['ollama', '--model', 'x']);
  assert.equal(result.providerId, 'OLLAMA');
  assert.deepEqual(result.claudeArgs, ['--model', 'x']);
});

test('detectRunModeArgs supports claude code provider forms', () => {
  const zai = detectRunModeArgs(['code', 'z.ai', '--model', 'x']);
  assert.equal(zai.providerId, 'ZAI');
  assert.deepEqual(zai.claudeArgs, ['code', '--model', 'x']);

  const minimax = detectRunModeArgs(['code', 'minimax', '--model', 'x']);
  assert.equal(minimax.providerId, 'MINIMAX');

  const ollama = detectRunModeArgs(['code', 'ollama', '--model', 'x']);
  assert.equal(ollama.providerId, 'OLLAMA');
  assert.deepEqual(ollama.claudeArgs, ['code', '--model', 'x']);
});

test('detectRunModeArgs keeps args untouched for default provider', () => {
  const result = detectRunModeArgs(['--print', 'hello']);
  assert.equal(result.providerId, 'CLAUDE');
  assert.deepEqual(result.claudeArgs, ['--print', 'hello']);
});

test('parseProfile reads flag and strips args', () => {
  const parsed = parseProfile(['z.ai', '--profile', 'strict', '--x'], {});
  assert.equal(parsed.profile, 'strict');
  assert.deepEqual(parsed.args, ['z.ai', '--x']);
});

test('parseProfile reads equals form and env fallback', () => {
  const parsed = parseProfile(['--profile=minimal', 'z.ai'], { CLAUDE_SWITCH_PROFILE: 'strict' });
  assert.equal(parsed.profile, 'minimal');
  assert.deepEqual(parsed.args, ['z.ai']);

  const envOnly = parseProfile(['z.ai'], { CLAUDE_SWITCH_PROFILE: 'strict' });
  assert.equal(envOnly.profile, 'strict');
});
