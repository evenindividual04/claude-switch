'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function getPathEntries(pathValue) {
  if (!pathValue) {
    return [];
  }

  return pathValue
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getClaudeExecutableNames() {
  if (process.platform === 'win32') {
    return ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'];
  }

  return ['claude'];
}

function safeRealpath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return null;
  }
}

function isExecutable(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }

    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findClaudeCandidates(pathValue) {
  const candidates = [];
  const seen = new Set();
  const executableNames = getClaudeExecutableNames();

  for (const dir of getPathEntries(pathValue)) {
    for (const name of executableNames) {
      const candidate = path.join(dir, name);
      if (seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);

      if (isExecutable(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function resolveRealClaudeBinary(options = {}) {
  const pathValue = options.pathValue || process.env.PATH || '';
  const currentScriptPath = options.currentScriptPath || '';
  const currentScriptRealPath = safeRealpath(currentScriptPath);

  const candidates = findClaudeCandidates(pathValue);

  const filtered = candidates.filter((candidate) => {
    if (currentScriptPath && path.resolve(candidate) === path.resolve(currentScriptPath)) {
      return false;
    }

    if (currentScriptRealPath) {
      const candidateRealPath = safeRealpath(candidate);
      if (candidateRealPath && candidateRealPath === currentScriptRealPath) {
        return false;
      }
    }

    return true;
  });

  return {
    candidates,
    filtered,
    selected: filtered[0] || null,
  };
}

function runClaude(binaryPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: 'inherit',
      env,
    });

    const forwardSignal = (signal) => {
      if (child && child.exitCode === null) {
        child.kill(signal);
      }
    };

    const onSigint = () => forwardSignal('SIGINT');
    const onSigterm = () => forwardSignal('SIGTERM');

    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    const cleanup = () => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
    };

    child.on('error', (err) => {
      cleanup();
      reject(err);
    });

    child.on('exit', (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}

module.exports = {
  findClaudeCandidates,
  resolveRealClaudeBinary,
  runClaude,
};
