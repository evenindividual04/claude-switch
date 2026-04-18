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
      '    ANTHROPIC_DEFAULT_OPUS_MODEL: Object.prototype.hasOwnProperty.call(process.env, "ANTHROPIC_DEFAULT_OPUS_MODEL") ? process.env.ANTHROPIC_DEFAULT_OPUS_MODEL : null,',
      '    ZAI_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "ZAI_API_KEY") ? process.env.ZAI_API_KEY : null,',
      '    MINIMAX_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "MINIMAX_API_KEY") ? process.env.MINIMAX_API_KEY : null,',
      '    OLLAMA_API_KEY: Object.prototype.hasOwnProperty.call(process.env, "OLLAMA_API_KEY") ? process.env.OLLAMA_API_KEY : null',
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

function runCli(args, env) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    env,
  });
}

test('run default mode clears anthropic override env vars', () => {
  const { binDir } = setupFakeClaude();

  const result = runCli(['run', '--print', 'hello'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    ANTHROPIC_API_KEY: 'abc',
    ANTHROPIC_AUTH_TOKEN: 'def',
    ANTHROPIC_BASE_URL: 'https://example.com',
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
  const result = runCli(['run', 'z.ai'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    ZAI_API_KEY: '',
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /ZAI_API_KEY is required/i);
});

test('run minimax mode fails when MINIMAX_API_KEY is missing', () => {
  const { binDir } = setupFakeClaude();
  const result = runCli(['run', 'minimax'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    MINIMAX_API_KEY: '',
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /MINIMAX_API_KEY is required/i);
});

test('run z.ai mode injects token + base URL and strict model map', () => {
  const { binDir } = setupFakeClaude();

  const result = runCli(['run', 'z.ai', '--profile', 'strict', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    ZAI_API_KEY: 'zai-secret',
    ANTHROPIC_API_KEY: 'should-be-cleared',
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
  assert.equal(payload.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'GLM-4.7');
});

test('run minimax mode injects token + base URL and forces empty API key', () => {
  const { binDir } = setupFakeClaude();

  const result = runCli(['run', 'minimax', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    MINIMAX_API_KEY: 'minimax-secret',
    ANTHROPIC_API_KEY: 'should-be-cleared',
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.deepEqual(payload.args, ['--format', 'json']);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'https://api.minimax.io/anthropic');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'minimax-secret');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('run ollama mode injects fallback token when OLLAMA_API_KEY is missing', () => {
  const { binDir } = setupFakeClaude();

  const result = runCli(['run', 'ollama', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    OLLAMA_API_KEY: '',
  });

  assert.equal(result.status, 0);
  const payload = parseJsonLine(result.stdout);
  assert.equal(payload.env.ANTHROPIC_BASE_URL, 'http://localhost:11434');
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, 'ollama');
  assert.equal(payload.env.ANTHROPIC_API_KEY, '');
});

test('run code provider modes preserve code subcommand', () => {
  const { binDir } = setupFakeClaude();

  const zai = runCli(['run', 'code', 'z.ai', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    ZAI_API_KEY: 'zai-secret',
  });
  assert.equal(zai.status, 0);
  assert.deepEqual(parseJsonLine(zai.stdout).args, ['code', '--format', 'json']);

  const minimax = runCli(['run', 'code', 'minimax', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    MINIMAX_API_KEY: 'minimax-secret',
  });
  assert.equal(minimax.status, 0);
  assert.deepEqual(parseJsonLine(minimax.stdout).args, ['code', '--format', 'json']);

  const ollama = runCli(['run', 'code', 'ollama', '--format', 'json'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
  });
  assert.equal(ollama.status, 0);
  assert.deepEqual(parseJsonLine(ollama.stdout).args, ['code', '--format', 'json']);
});

test('status prints expected env diagnostic labels including ollama', () => {
  const result = runCli(['status'], {
    ...process.env,
    ANTHROPIC_API_KEY: 'abc',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_BASE_URL: '',
    ZAI_API_KEY: 'zai-key',
    MINIMAX_API_KEY: 'minimax-key',
    OLLAMA_API_KEY: 'ollama-key',
    CLAUDE_SWITCH_PROFILE: 'strict',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'GLM-4.7',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Provider: Claude/);
  assert.match(result.stdout, /Profile: strict/);
  assert.match(result.stdout, /ZAI_API_KEY: detected/);
  assert.match(result.stdout, /MINIMAX_API_KEY: detected/);
  assert.match(result.stdout, /OLLAMA_API_KEY: detected/);
  assert.match(result.stdout, /Model Mapping:/);
});

test('doctor runs and reports expected sections', () => {
  const { binDir } = setupFakeClaude();
  const result = runCli(['doctor'], {
    ...process.env,
    PATH: [binDir, process.env.PATH || ''].join(path.delimiter),
    ZAI_API_KEY: 'x',
    MINIMAX_API_KEY: 'y',
  });

  assert.match(result.stdout, /claude-switch doctor/);
  assert.match(result.stdout, /Resolved Claude binary/);
});

test('completion emits shell scripts', () => {
  const zsh = runCli(['completion', 'zsh'], process.env);
  assert.equal(zsh.status, 0);
  assert.match(zsh.stdout, /compdef claude-switch/);

  const bad = runCli(['completion', 'powershell'], process.env);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unsupported shell/);
});

test('cache usage writes provider usage cache file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-cache-'));
  const usagePath = path.join(tmp, 'provider-usage-cache.json');

  const result = runCli(
    ['cache', 'usage', '--provider', 'z.ai', '--percentage', '74', '--label', 'quota'],
    {
      ...process.env,
      PROVIDER_USAGE_CACHE_FILE: usagePath,
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Wrote usage cache/);

  const payload = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
  assert.equal(payload.provider, 'z.ai');
  assert.equal(payload.label, 'quota');
  assert.equal(payload.percentage, 74);
  assert.ok(payload.timestamp > 0);
});

test('cache health writes provider health cache file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-cache-'));
  const healthPath = path.join(tmp, 'provider-health-cache.json');

  const result = runCli(
    ['cache', 'health', '--provider', 'z.ai', '--status', 'ok', '--latency-ms', '123'],
    {
      ...process.env,
      PROVIDER_HEALTH_CACHE_FILE: healthPath,
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Wrote health cache/);

  const payload = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
  assert.equal(payload.provider, 'z.ai');
  assert.equal(payload.status, 'ok');
  assert.equal(payload.latency_ms, 123);
  assert.ok(payload.timestamp > 0);
});

test('cache clear removes usage and health files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-cache-'));
  const usagePath = path.join(tmp, 'provider-usage-cache.json');
  const healthPath = path.join(tmp, 'provider-health-cache.json');
  fs.writeFileSync(usagePath, '{}', 'utf8');
  fs.writeFileSync(healthPath, '{}', 'utf8');

  const result = runCli(
    ['cache', 'clear', '--target', 'all'],
    {
      ...process.env,
      PROVIDER_USAGE_CACHE_FILE: usagePath,
      PROVIDER_HEALTH_CACHE_FILE: healthPath,
    }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Cleared cache target: all/);
  assert.equal(fs.existsSync(usagePath), false);
  assert.equal(fs.existsSync(healthPath), false);
});

test('cache usage validates percentage bounds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-cache-'));
  const usagePath = path.join(tmp, 'provider-usage-cache.json');

  const result = runCli(
    ['cache', 'usage', '--provider', 'z.ai', '--percentage', '500'],
    {
      ...process.env,
      PROVIDER_USAGE_CACHE_FILE: usagePath,
    }
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage percentage/);
});

test('probe command returns structured failure on unreachable endpoint', () => {
  const result = runCli(['probe', 'ollama'], {
    ...process.env,
    OLLAMA_BASE_URL: 'http://127.0.0.1:1',
  });

  assert.equal(result.status, 7);
  assert.match(result.stderr, /Probe failed/);
});

test('version flag matches package.json version', () => {
  const result = runCli(['--version'], process.env);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), PACKAGE_JSON.version);
});
