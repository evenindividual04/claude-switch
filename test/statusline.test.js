'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DEFAULT_SCRIPT = path.join(os.homedir(), '.claude', 'statusline-command.sh');
const STATUSLINE_SCRIPT = process.env.CLAUDE_STATUSLINE_SCRIPT || DEFAULT_SCRIPT;
const TEST_CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-statusline-cache-'));
const TEST_STATE_FILE = path.join(TEST_CACHE_DIR, 'statusline-state.json');
const TEST_GLM_CACHE = path.join(TEST_CACHE_DIR, 'glm-cache.json');
const TEST_USAGE_CACHE = path.join(TEST_CACHE_DIR, 'provider-usage-cache.json');
const TEST_HEALTH_CACHE = path.join(TEST_CACHE_DIR, 'provider-health-cache.json');

function hasExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasJq() {
  const result = spawnSync('sh', ['-c', 'command -v jq >/dev/null 2>&1'], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function runStatusline(input, extraEnv = {}) {
  return spawnSync('sh', [STATUSLINE_SCRIPT], {
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      STATUSLINE_STATE_FILE: TEST_STATE_FILE,
      GLM_CACHE_FILE: TEST_GLM_CACHE,
      PROVIDER_USAGE_CACHE_FILE: TEST_USAGE_CACHE,
      PROVIDER_HEALTH_CACHE_FILE: TEST_HEALTH_CACHE,
      ...extraEnv,
    },
  });
}

const canRun = hasExecutable(STATUSLINE_SCRIPT) && hasJq();
const maybeTest = canRun ? test : test.skip;

maybeTest('statusline shows provider and model for Z.AI payload', () => {
  const payload = JSON.stringify({
    context_window: {
      used_percentage: 42,
      current_usage: { total_tokens: 42000 },
      context_window_size: 100000,
    },
    model: {
      display_name: 'GLM-4.7',
      id: 'glm-4.7',
    },
    usage_windows: {
      '5h': { used: 10, limit: 100 },
    },
    cwd: process.cwd(),
    workspace: {
      project_dir: process.cwd(),
    },
  });

  const result = runStatusline(payload, {
    ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Z\.AI/);
  assert.match(result.stdout, /model: GLM-4\.7/);
  assert.match(result.stdout, /ctx:/);
  assert.match(result.stdout, /rem:/);
});

maybeTest('statusline detects MiniMax from base URL and renders model', () => {
  const payload = JSON.stringify({
    context_window: { used_percentage: 11 },
    model: { display_name: 'MiniMax-M2.1', id: 'minimax-m2.1' },
    cwd: process.cwd(),
  });

  const result = runStatusline(payload, {
    ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /MiniMax/);
  assert.match(result.stdout, /model: MiniMax-M2\.1/);
});

maybeTest('statusline detects Ollama from localhost base URL', () => {
  const payload = JSON.stringify({
    context_window: { used_percentage: 9 },
    model: { display_name: 'qwen2.5-coder', id: 'qwen2.5-coder' },
    cwd: process.cwd(),
  });

  const result = runStatusline(payload, {
    ANTHROPIC_BASE_URL: 'http://localhost:11434',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Ollama/);
  assert.match(result.stdout, /model: qwen2\.5-coder/);
});

maybeTest('statusline shows fallback text on malformed JSON input', () => {
  const result = runStatusline('{not-json', {
    ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /(status unavailable|Z\.AI|model: unknown)/);
});

maybeTest('statusline renders git branch marker in a repo', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-statusline-'));
  spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
  spawnSync('git', ['checkout', '-b', 'statusline-test'], { cwd: tmp, encoding: 'utf8' });

  const payload = JSON.stringify({
    context_window: { used_percentage: 1 },
    model: { display_name: 'Claude Sonnet', id: 'sonnet' },
    cwd: tmp,
    workspace: { project_dir: tmp },
  });

  const result = runStatusline(payload);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /statusline-test/);
});

maybeTest('statusline shows delta and burn-rate from state cache', () => {
  const now = Math.floor(Date.now() / 1000);
  fs.writeFileSync(TEST_STATE_FILE, JSON.stringify({ timestamp: now - 60, total_tokens: 1000 }), 'utf8');

  const payload = JSON.stringify({
    context_window: {
      used_percentage: 65,
      current_usage: { total_tokens: 1300 },
      context_window_size: 2000,
    },
    model: { display_name: 'Claude Sonnet' },
    cwd: process.cwd(),
  });

  const result = runStatusline(payload);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Δ:/);
  assert.match(result.stdout, /t\/m/);
});

maybeTest('statusline shows optional provider usage and health cache segments', () => {
  const now = Math.floor(Date.now() / 1000);
  fs.writeFileSync(TEST_USAGE_CACHE, JSON.stringify({ percentage: 74, label: 'quota', timestamp: now }), 'utf8');
  fs.writeFileSync(TEST_HEALTH_CACHE, JSON.stringify({ status: 'ok', latency_ms: 123, timestamp: now }), 'utf8');

  const payload = JSON.stringify({
    context_window: { used_percentage: 10 },
    model: { display_name: 'Claude Sonnet' },
    cwd: process.cwd(),
  });

  const result = runStatusline(payload);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /quota: 74%/);
  assert.match(result.stdout, /net:ok/);
  assert.match(result.stdout, /123ms/);
});

if (!canRun) {
  test('statusline suite skipped when prerequisites are missing', () => {
    assert.ok(true);
  });
}
