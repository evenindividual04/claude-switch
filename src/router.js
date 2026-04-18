'use strict';

const os = require('node:os');
const logger = require('./logger');
const {
  PROFILES,
  buildProviderEnv,
  getProviderByToken,
  getProviderById,
  listSelectableProviders,
  listSupportedCommands,
  normalizeProfile,
  readTrimmedEnvVar,
} = require('./env');
const { EXIT_CODES } = require('./exit-codes');
const { resolveRealClaudeBinary, runClaude } = require('./runner');
const { collectDiagnostics, printStatus, printDebug } = require('./diagnostics');
const { runDoctor, printDoctorReport, hasFailures } = require('./doctor');
const { probeEndpoint } = require('./probe');
const { writeUsageCache, writeHealthCache, clearCache } = require('./cache');
const { renderCompletion } = require('./completion');
const { version } = require('../package.json');

function providerTokenHelpText() {
  return listSelectableProviders()
    .map((provider) => provider.selectorTokens[0])
    .join(' | ');
}

function printHelp() {
  const providerTokens = providerTokenHelpText();

  console.log('claude-switch <command>');
  console.log('');
  console.log('Commands:');
  console.log(`  run [${providerTokens}] [--profile minimal|strict] [claude args...]`);
  console.log('  status');
  console.log(`  debug [${providerTokens}] [--profile minimal|strict] [claude args...]`);
  console.log('  doctor');
  console.log(`  probe <${providerTokens}>`);
  console.log('  cache <usage|health|clear> [args]');
  console.log('  completion <bash|zsh|fish>');
  console.log('  help');
}

function parseProfile(args, baseEnv) {
  let profile = normalizeProfile(readTrimmedEnvVar(baseEnv, 'CLAUDE_SWITCH_PROFILE') || PROFILES.MINIMAL);
  const cleaned = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--profile') {
      const value = args[i + 1];
      profile = normalizeProfile(value || profile);
      i += 1;
      continue;
    }

    if (arg.startsWith('--profile=')) {
      const value = arg.slice('--profile='.length);
      profile = normalizeProfile(value || profile);
      continue;
    }

    cleaned.push(arg);
  }

  return {
    profile,
    args: cleaned,
  };
}

function detectRunModeArgs(args) {
  const firstTokenProvider = getProviderByToken(args[0]);
  if (firstTokenProvider) {
    return {
      providerId: firstTokenProvider.id,
      providerLabel: firstTokenProvider.label,
      providerArgConsumed: true,
      selectorToken: args[0],
      claudeArgs: args.slice(1),
    };
  }

  const codeSubcommandProvider = args[0] === 'code' ? getProviderByToken(args[1]) : null;
  if (codeSubcommandProvider) {
    return {
      providerId: codeSubcommandProvider.id,
      providerLabel: codeSubcommandProvider.label,
      providerArgConsumed: true,
      selectorToken: args[1],
      claudeArgs: ['code', ...args.slice(2)],
    };
  }

  const defaultProvider = getProviderById('CLAUDE');
  return {
    providerId: defaultProvider.id,
    providerLabel: defaultProvider.label,
    providerArgConsumed: false,
    selectorToken: null,
    claudeArgs: args.slice(),
  };
}

function buildEnvDelta(baseEnv, nextEnv) {
  const delta = {};

  for (const [key, value] of Object.entries(nextEnv)) {
    if (baseEnv[key] !== value) {
      delta[key] = value;
    }
  }

  for (const key of Object.keys(baseEnv)) {
    if (!Object.prototype.hasOwnProperty.call(nextEnv, key)) {
      delta[key] = null;
    }
  }

  return delta;
}

function parseFlagMap(args) {
  const flags = {};
  const rest = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      rest.push(arg);
      continue;
    }

    if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      const key = arg.slice(2, idx);
      const value = arg.slice(idx + 1);
      flags[key] = value;
      continue;
    }

    const key = arg.slice(2);
    const value = args[i + 1];
    if (value && !value.startsWith('--')) {
      flags[key] = value;
      i += 1;
    } else {
      flags[key] = 'true';
    }
  }

  return { flags, rest };
}

function exitWithSignal(signal) {
  process.kill(process.pid, signal);
}

function validateProviderCredentials(baseEnv, providerId) {
  const provider = getProviderById(providerId);

  if (!provider.credentialEnvVar || !provider.requireCredential) {
    return null;
  }

  const value = readTrimmedEnvVar(baseEnv, provider.credentialEnvVar);
  if (value.length === 0) {
    return {
      code: EXIT_CODES.MISSING_CREDENTIAL,
      message: `${provider.credentialEnvVar} is required for ${provider.selectorTokens[0]} mode.`,
    };
  }

  return null;
}

async function handleRun(args, options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const parsedProfile = parseProfile(args, baseEnv);
  const runConfig = detectRunModeArgs(parsedProfile.args);

  const credentialError = validateProviderCredentials(baseEnv, runConfig.providerId);
  if (credentialError) {
    logger.error(credentialError.message);
    return credentialError.code;
  }

  const envResult = buildProviderEnv(baseEnv, runConfig.providerId, {
    profile: parsedProfile.profile,
  });

  if (!envResult.ok) {
    logger.error(envResult.error);
    return EXIT_CODES.INVALID_USAGE;
  }

  const resolution = resolveRealClaudeBinary({
    pathValue: baseEnv.PATH,
    currentScriptPath: options.currentScriptPath || process.argv[1],
  });

  if (!resolution.selected) {
    logger.error('Unable to find a real "claude" binary on PATH (after excluding this wrapper).');
    logger.error('Install Claude CLI or adjust your PATH.');
    return EXIT_CODES.CLAUDE_BINARY_NOT_FOUND;
  }

  logger.mode(runConfig.providerId);

  try {
    const result = await runClaude(resolution.selected, runConfig.claudeArgs, envResult.env);

    if (result.signal) {
      exitWithSignal(result.signal);
      return EXIT_CODES.UNKNOWN_ERROR;
    }

    return typeof result.code === 'number' ? result.code : EXIT_CODES.UNKNOWN_ERROR;
  } catch (err) {
    logger.error(`Failed to spawn Claude: ${err.message}`);
    return EXIT_CODES.SPAWN_FAILED;
  }
}

function handleStatus(options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const diag = collectDiagnostics(baseEnv);
  printStatus(diag, logger);
  return EXIT_CODES.OK;
}

function handleDebug(args, options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const parsedProfile = parseProfile(args, baseEnv);
  const runConfig = detectRunModeArgs(parsedProfile.args);
  const resolution = resolveRealClaudeBinary({
    pathValue: baseEnv.PATH,
    currentScriptPath: options.currentScriptPath || process.argv[1],
  });
  const diag = collectDiagnostics(baseEnv);

  const envResult = buildProviderEnv(baseEnv, runConfig.providerId, {
    profile: parsedProfile.profile,
  });

  const envForDebug = envResult.ok ? envResult.env : baseEnv;

  printDebug({
    provider: runConfig.providerLabel,
    providerId: runConfig.providerId,
    profile: parsedProfile.profile,
    providerArgConsumed: runConfig.providerArgConsumed,
    selectorToken: runConfig.selectorToken,
    argv: runConfig.claudeArgs,
    resolvedBinary: resolution.selected,
    candidates: resolution.filtered,
    detectedProvider: diag.provider,
    envDelta: buildEnvDelta(baseEnv, envForDebug),
    env: envForDebug,
  });

  if (!envResult.ok) {
    logger.warn(envResult.error);
  }

  for (const warning of diag.warnings) {
    logger.warn(warning);
  }

  return EXIT_CODES.OK;
}

function handleDoctor(options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const checks = runDoctor(baseEnv, options.currentScriptPath || process.argv[1]);
  printDoctorReport(checks);
  return hasFailures(checks) ? EXIT_CODES.PROBE_FAILED : EXIT_CODES.OK;
}

async function handleProbe(args, options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const token = args[0];
  const provider = getProviderByToken(token);

  if (!provider) {
    logger.error(`Invalid provider token: ${token || '(missing)'}`);
    logger.error(`Supported providers: ${providerTokenHelpText()}`);
    return EXIT_CODES.INVALID_PROVIDER;
  }

  const envResult = buildProviderEnv(baseEnv, provider.id, {
    profile: PROFILES.MINIMAL,
  });

  if (!envResult.ok) {
    logger.error(envResult.error);
    return EXIT_CODES.INVALID_USAGE;
  }

  const url = envResult.baseUrl || provider.baseUrl;
  const result = await probeEndpoint(url, 3000);

  if (!result.ok) {
    logger.error(`Probe failed for ${provider.label} (${url}): ${result.message}`);
    return EXIT_CODES.PROBE_FAILED;
  }

  console.log(`${provider.label} probe OK: ${result.message} (${url})`);
  return EXIT_CODES.OK;
}

function handleCache(args, options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const action = args[0];
  const parsed = parseFlagMap(args.slice(1));
  const home = baseEnv.HOME || os.homedir();
  const usagePath = readTrimmedEnvVar(baseEnv, 'PROVIDER_USAGE_CACHE_FILE') || `${home}/.claude/provider-usage-cache.json`;
  const healthPath = readTrimmedEnvVar(baseEnv, 'PROVIDER_HEALTH_CACHE_FILE') || `${home}/.claude/provider-health-cache.json`;

  if (action === 'usage') {
    const result = writeUsageCache({
      filePath: usagePath,
      provider: parsed.flags.provider || parsed.flags.p || 'unknown',
      label: parsed.flags.label || 'quota',
      percentage: parsed.flags.percentage,
      timestamp: parsed.flags.timestamp,
    });

    if (!result.ok) {
      logger.error(result.error);
      return EXIT_CODES.INVALID_USAGE;
    }

    console.log(`Wrote usage cache: ${usagePath}`);
    return EXIT_CODES.OK;
  }

  if (action === 'health') {
    const result = writeHealthCache({
      filePath: healthPath,
      provider: parsed.flags.provider || parsed.flags.p || 'unknown',
      status: parsed.flags.status,
      latencyMs: parsed.flags['latency-ms'],
      timestamp: parsed.flags.timestamp,
    });

    if (!result.ok) {
      logger.error(result.error);
      return EXIT_CODES.INVALID_USAGE;
    }

    console.log(`Wrote health cache: ${healthPath}`);
    return EXIT_CODES.OK;
  }

  if (action === 'clear') {
    const target = parsed.flags.target || 'all';

    if (target === 'usage' || target === 'all') {
      clearCache(usagePath);
    }

    if (target === 'health' || target === 'all') {
      clearCache(healthPath);
    }

    console.log(`Cleared cache target: ${target}`);
    return EXIT_CODES.OK;
  }

  logger.error('cache command requires one of: usage, health, clear');
  logger.error('Examples:');
  logger.error('  claude-switch cache usage --provider z.ai --percentage 74 --label quota');
  logger.error('  claude-switch cache health --provider z.ai --status ok --latency-ms 120');
  logger.error('  claude-switch cache clear --target all');
  return EXIT_CODES.INVALID_USAGE;
}

function handleCompletion(args) {
  const shell = args[0];

  if (!shell) {
    logger.error('completion requires a shell argument: bash | zsh | fish');
    return EXIT_CODES.INVALID_USAGE;
  }

  const script = renderCompletion(shell, 'claude-switch');
  if (!script) {
    logger.error(`Unsupported shell: ${shell}`);
    return EXIT_CODES.INVALID_USAGE;
  }

  process.stdout.write(script);
  return EXIT_CODES.OK;
}

async function runCli(argv, options = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return EXIT_CODES.OK;
  }

  if (command === '--version' || command === '-v') {
    console.log(version);
    return EXIT_CODES.OK;
  }

  if (command === 'run') {
    return handleRun(args.slice(1), options);
  }

  if (command === 'status') {
    return handleStatus(options);
  }

  if (command === 'debug') {
    return handleDebug(args.slice(1), options);
  }

  if (command === 'doctor') {
    return handleDoctor(options);
  }

  if (command === 'probe') {
    return handleProbe(args.slice(1), options);
  }

  if (command === 'completion') {
    return handleCompletion(args.slice(1));
  }

  if (command === 'cache') {
    return handleCache(args.slice(1), options);
  }

  logger.error(`Unknown command: ${command}`);
  logger.error(`Supported commands: ${listSupportedCommands().join(', ')}`);
  printHelp();
  return EXIT_CODES.INVALID_USAGE;
}

module.exports = {
  detectRunModeArgs,
  parseProfile,
  handleRun,
  handleStatus,
  handleDebug,
  handleDoctor,
  handleProbe,
  handleCache,
  handleCompletion,
  runCli,
};
