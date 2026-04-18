'use strict';

const fs = require('node:fs');
const path = require('node:path');

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJsonAtomic(filePath, payload) {
  ensureParentDir(filePath);
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function parseInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

function writeUsageCache(options) {
  const timestamp = parseInteger(options.timestamp, Math.floor(Date.now() / 1000));
  const percentage = parseFloatNumber(options.percentage, null);

  if (percentage === null || percentage < 0 || percentage > 100) {
    return {
      ok: false,
      error: 'Usage percentage must be a number between 0 and 100.',
    };
  }

  const payload = {
    provider: options.provider || 'unknown',
    label: options.label || 'quota',
    percentage,
    timestamp,
  };

  writeJsonAtomic(options.filePath, payload);
  return {
    ok: true,
    payload,
  };
}

function writeHealthCache(options) {
  const timestamp = parseInteger(options.timestamp, Math.floor(Date.now() / 1000));
  const status = typeof options.status === 'string' ? options.status.trim().toLowerCase() : '';
  const allowed = new Set(['ok', 'slow', 'down']);

  if (!allowed.has(status)) {
    return {
      ok: false,
      error: 'Health status must be one of: ok, slow, down.',
    };
  }

  const payload = {
    provider: options.provider || 'unknown',
    status,
    latency_ms: parseInteger(options.latencyMs, null),
    timestamp,
  };

  writeJsonAtomic(options.filePath, payload);
  return {
    ok: true,
    payload,
  };
}

function clearCache(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (!err || err.code !== 'ENOENT') {
      throw err;
    }
  }
}

module.exports = {
  writeUsageCache,
  writeHealthCache,
  clearCache,
};
