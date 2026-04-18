'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'claude-switch.js');
const PACKAGE_JSON = require('../package.json');

function makeNodeExecutable(filePath, body) {
  fs.writeFileSync(filePath, `#!/usr/bin/env node\n${body}\n`, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function setupFakeClaude() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-integration-'));
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir);

  const fakeClaude = path.join(binDir, 'claude');
  makeNodeExecutable(
    fakeClaude,
    [
      'const payload = {',
      '  args: process.argv.slice(2),',
      '  env: {',
      '    ANTHROPIC_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_API_KEY") ? process.env.ANTHROPIC_API_KEY : null,',
      '    ANTHROPIC_AUTH_TOKEN: Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_AUTH_TOKEN") ? process.env.ANTHROPIC_AUTH_TOKEN : null,',
      '    ANTHROPIC_BASE_URL: Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_BASE_URL") ? process.env.ANTHROPIC_BASE_URL : null,',
      '    ZAI_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "ZAI_API_KEY") ? process.env.ZAI_API_KEY : null,',
      '    MINIMAX_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "MINIMAX_API_KEY") ? process.env.MINIMAX_API_KEY : null',
      '  }',
      '};',
      'console.log(JSON.stringify(payload));',
    ].join('\n')
  );

  return { root, binDir, fakeClaude };
}

function parseJsonLine(stdout) {
  const lines = stdout.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (line.startsWith('{') && line.endsWith('}')) {
      return JSON.parse(line);
    }
  }

  throw new Error('No JSON payload found in stdout');
}

test('run default mode clears anthropic override env vars', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', '--print', 'hello'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      ANTHROPIC_API_KEY: 'abc',
      ANTHROPIC_AUTH_TOKEN: 'def',
      ANTHROPIC_BASE_URL: 'https://example.com',
    },
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['--print', 'hello']);
  assert.equal(payload.env.ANTHROPIC_API_KEY, null);
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, null);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, null);
});

test('run z.ai mode fails when ZAI_API_KEY is missing', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'z.ai'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      ZAI_API_KEY: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ZAI_API_KEY is required/i);
});

test('run z.ai mode fails when ZAI_API_KEY is whitespace-only', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'z.ai'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      ZAI_API_KEY: '   ',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ZAI_API_KEY is required/i);
});

test('run minimax mode fails when MINIMAX_API_KEY is missing', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'minimax'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      MINIMAX_API_KEY: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MINIMAX_API_KEY is required/i);
});

test('run z.ai mode injects token + base URL and forces empty API key', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'z.ai', '--format', 'json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      ZAI_API_KEY: 'zai-secret',
      ANTHROPIC_API_KEY: 'should-be-cleared',
    },
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('run minimax mode injects token + base URL and forces empty API key', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'minimax', '--format', 'json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      MINIMAX_API_KEY: 'minimax-secret',
      ANTHROPIC_API_KEY: 'should-be-cleared',
    },
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.minimax.io/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'minimax-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('run code z.ai mode injects token + base URL and preserves code subcommand', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'code', 'z.ai', '--format', 'json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      ZAI_API_KEY: 'zai-secret',
      ANTHROPIC_API_KEY: 'should-be-cleared',
    },
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['code', '--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('run code minimax mode injects token + base URL and preserves code subcommand', () => {
  const { binDir } = setupFakeClaude();

  const result = spawnSync(process.execPath, [CLI_PATH, 'run', 'code', 'minimax', '--format', 'json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
      MINIMAX_API_KEY: 'minimax-secret',
      ANTHROPIC_API_KEY: 'should-be-cleared',
    },
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['code', '--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.minimax.io/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'minimax-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('status prints expected env diagnostic labels including MiniMax key', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, 'status'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: 'abc',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_BASE_URL: '',
      ZAI_API_KEY: 'zai-key',
      MINIMAX_API_KEY: 'minimax-key',
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Provider: Claude/);
  assert.match(result.stdout, /ANTHROPIC_API_KEY: detected/);
  assert.match(result.stdout, /ANTHROPIC_AUTH_TOKEN: missing/);
  assert.match(result.stdout, /ANTHROPIC_BASE_URL: unset/);
  assert.match(result.stdout, /ZAI_API_KEY: detected/);
  assert.match(result.stdout, /MINIMAX_API_KEY: detected/);
});

test('version flag matches package.json version', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--version'], {
    encoding: 'utf8',
    env: {
      ...process.env,
    },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), PACKAGE_JSON.version);
});
