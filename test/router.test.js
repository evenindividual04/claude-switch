'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { detectRunModeArgs } = require('../src/router');

test('detectRunModeArgs routes to ZAI when first arg is z.ai', () => {
  const result = detectRunModeArgs(['z.ai', '--model', 'x']);

  assert.equal(result.providerId, 'ZAI');
  assert.equal(result.providerArgConsumed, true);
  assert.deepEqual(result.claudeArgs, ['--model', 'x']);
});

test('detectRunModeArgs routes to MiniMax when first arg is minimax', () => {
  const result = detectRunModeArgs(['minimax', '--model', 'x']);

  assert.equal(result.providerId, 'MINIMAX');
  assert.equal(result.providerArgConsumed, true);
  assert.deepEqual(result.claudeArgs, ['--model', 'x']);
});

test('detectRunModeArgs keeps args untouched for default provider', () => {
  const args = ['--print', 'hello'];
  const result = detectRunModeArgs(args);

  assert.equal(result.providerId, 'CLAUDE');
  assert.equal(result.providerArgConsumed, false);
  assert.deepEqual(result.claudeArgs, ['--print', 'hello']);
});

test('detectRunModeArgs supports claude code z.ai form', () => {
  const result = detectRunModeArgs(['code', 'z.ai', '--model', 'x']);

  assert.equal(result.providerId, 'ZAI');
  assert.equal(result.providerArgConsumed, true);
  assert.deepEqual(result.claudeArgs, ['code', '--model', 'x']);
});

test('detectRunModeArgs supports claude code minimax form', () => {
  const result = detectRunModeArgs(['code', 'minimax', '--model', 'x']);

  assert.equal(result.providerId, 'MINIMAX');
  assert.equal(result.providerArgConsumed, true);
  assert.deepEqual(result.claudeArgs, ['code', '--model', 'x']);
});

test('detectRunModeArgs does not treat unrelated later z.ai token as provider switch', () => {
  const result = detectRunModeArgs(['--project', 'z.ai']);

  assert.equal(result.providerId, 'CLAUDE');
  assert.deepEqual(result.claudeArgs, ['--project', 'z.ai']);
});
