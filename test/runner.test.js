'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveRealClaudeBinary } = require('../src/runner');

function makeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

test('resolveRealClaudeBinary picks first valid candidate on PATH', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-runner-'));
  const dirA = path.join(root, 'a');
  const dirB = path.join(root, 'b');
  fs.mkdirSync(dirA);
  fs.mkdirSync(dirB);

  const claudeA = path.join(dirA, 'claude');
  const claudeB = path.join(dirB, 'claude');

  makeExecutable(claudeA, '#!/bin/sh\necho a\n');
  makeExecutable(claudeB, '#!/bin/sh\necho b\n');

  const result = resolveRealClaudeBinary({
    pathValue: [dirA, dirB].join(path.delimiter),
    currentScriptPath: '/does/not/matter',
  });

  assert.equal(result.selected, claudeA);
  assert.deepEqual(result.filtered, [claudeA, claudeB]);
});

test('resolveRealClaudeBinary excludes current script by realpath', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-runner-'));
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir);

  const realBinary = path.join(binDir, 'real-claude');
  const wrapperLink = path.join(binDir, 'claude');
  makeExecutable(realBinary, '#!/bin/sh\necho real\n');
  fs.symlinkSync(realBinary, wrapperLink);

  const secondDir = path.join(root, 'second');
  fs.mkdirSync(secondDir);
  const fallbackClaude = path.join(secondDir, 'claude');
  makeExecutable(fallbackClaude, '#!/bin/sh\necho fallback\n');

  const result = resolveRealClaudeBinary({
    pathValue: [binDir, secondDir].join(path.delimiter),
    currentScriptPath: realBinary,
  });

  assert.equal(result.selected, fallbackClaude);
  assert.deepEqual(result.filtered, [fallbackClaude]);
});
