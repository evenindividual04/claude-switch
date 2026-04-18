'use strict';

const { resolveRealClaudeBinary } = require('./runner');
const { collectDiagnostics } = require('./diagnostics');
const { listSelectableProviders, resolveProviderBaseUrl } = require('./env');

function runDoctor(baseEnv, currentScriptPath) {
  const checks = [];

  const resolution = resolveRealClaudeBinary({
    pathValue: baseEnv.PATH,
    currentScriptPath,
  });

  if (resolution.selected) {
    checks.push({
      id: 'claude_binary',
      ok: true,
      message: `Resolved Claude binary: ${resolution.selected}`,
    });
  } else {
    checks.push({
      id: 'claude_binary',
      ok: false,
      message: 'Could not resolve a real "claude" binary on PATH.',
      fix: 'Install Claude CLI and ensure PATH contains it before the wrapper alias.',
    });
  }

  checks.push({
    id: 'alias_hint',
    ok: true,
    message: 'Expected alias: alias claude="claude-switch run"',
  });

  for (const provider of listSelectableProviders()) {
    const baseUrlCheck = resolveProviderBaseUrl(baseEnv, provider);
    if (!baseUrlCheck.ok) {
      checks.push({
        id: `${provider.id.toLowerCase()}_base_url`,
        ok: false,
        message: baseUrlCheck.error,
      });
    }

    if (provider.requireCredential) {
      const value = typeof baseEnv[provider.credentialEnvVar] === 'string'
        ? baseEnv[provider.credentialEnvVar].trim()
        : '';

      checks.push({
        id: `${provider.id.toLowerCase()}_credential`,
        ok: value.length > 0,
        message: `${provider.credentialEnvVar}: ${value.length > 0 ? 'present' : 'missing'}`,
        fix: value.length > 0 ? undefined : `Set ${provider.credentialEnvVar} before using ${provider.selectorTokens[0]} mode.`,
      });
    }
  }

  const diag = collectDiagnostics(baseEnv);
  if (diag.warnings.length === 0) {
    checks.push({
      id: 'conflicts',
      ok: true,
      message: 'No high-confidence env conflicts detected.',
    });
  } else {
    for (const warning of diag.warnings) {
      checks.push({
        id: 'conflict_warning',
        ok: false,
        message: warning,
      });
    }
  }

  return checks;
}

function printDoctorReport(checks) {
  console.log('claude-switch doctor');
  console.log('');

  for (const check of checks) {
    const marker = check.ok ? 'OK' : 'FAIL';
    console.log(`[${marker}] ${check.message}`);
    if (check.fix) {
      console.log(`  fix: ${check.fix}`);
    }
  }
}

function hasFailures(checks) {
  return checks.some((check) => !check.ok);
}

module.exports = {
  runDoctor,
  printDoctorReport,
  hasFailures,
};
