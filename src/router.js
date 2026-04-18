'use strict';

const logger = require('./logger');
const {
  buildProviderEnv,
  getProviderByToken,
  getProviderById,
  listSelectableProviders,
} = require('./env');
const { resolveRealClaudeBinary, runClaude } = require('./runner');
const { collectDiagnostics, printStatus, printDebug } = require('./diagnostics');
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
  console.log(`  run [${providerTokens}] [claude args...]      Run Claude with runtime provider switching`);
  console.log('  status                                   Show provider + auth env diagnostics');
  console.log(`  debug [${providerTokens}] [claude args...]    Show provider/env/executable diagnostics`);
  console.log('  help                                     Show this help message');
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

  // Support `claude code <provider>` by treating provider tokens as selectors
  // when they appear directly after the `code` subcommand.
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

function exitWithSignal(signal) {
  process.kill(process.pid, signal);
}

function readTrimmedEnvVar(baseEnv, name) {
  return typeof baseEnv[name] === 'string' ? baseEnv[name].trim() : '';
}

function validateProviderCredentials(baseEnv, providerId) {
  const provider = getProviderById(providerId);

  if (!provider.credentialEnvVar) {
    return null;
  }

  const value = readTrimmedEnvVar(baseEnv, provider.credentialEnvVar);
  if (value.length === 0) {
    return `${provider.credentialEnvVar} is required for ${provider.selectorTokens[0]} mode.`;
  }

  return null;
}

async function handleRun(args, options = {}) {
  const runConfig = detectRunModeArgs(args);
  const baseEnv = options.baseEnv || process.env;

  const credentialError = validateProviderCredentials(baseEnv, runConfig.providerId);
  if (credentialError) {
    logger.error(credentialError);
    return 1;
  }

  const resolution = resolveRealClaudeBinary({
    pathValue: baseEnv.PATH,
    currentScriptPath: options.currentScriptPath || process.argv[1],
  });

  if (!resolution.selected) {
    logger.error('Unable to find a real "claude" binary on PATH (after excluding this wrapper).');
    logger.error('Install Claude CLI or adjust your PATH.');
    return 1;
  }

  const env = buildProviderEnv(baseEnv, runConfig.providerId);

  logger.mode(runConfig.providerId);

  try {
    const result = await runClaude(resolution.selected, runConfig.claudeArgs, env);

    if (result.signal) {
      exitWithSignal(result.signal);
      return 1;
    }

    return typeof result.code === 'number' ? result.code : 1;
  } catch (err) {
    logger.error(`Failed to spawn Claude: ${err.message}`);
    return 1;
  }
}

function handleStatus(options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const diag = collectDiagnostics(baseEnv);
  printStatus(diag, logger);
  return 0;
}

function handleDebug(args, options = {}) {
  const baseEnv = options.baseEnv || process.env;
  const runConfig = detectRunModeArgs(args);
  const resolution = resolveRealClaudeBinary({
    pathValue: baseEnv.PATH,
    currentScriptPath: options.currentScriptPath || process.argv[1],
  });
  const diag = collectDiagnostics(baseEnv);

  printDebug({
    provider: runConfig.providerLabel,
    providerId: runConfig.providerId,
    providerArgConsumed: runConfig.providerArgConsumed,
    selectorToken: runConfig.selectorToken,
    argv: runConfig.claudeArgs,
    resolvedBinary: resolution.selected,
    candidates: resolution.filtered,
    detectedProvider: diag.provider,
    env: baseEnv,
  });

  for (const warning of diag.warnings) {
    logger.warn(warning);
  }

  return 0;
}

async function runCli(argv, options = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  if (command === '--version' || command === '-v') {
    console.log(version);
    return 0;
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

  logger.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

module.exports = {
  detectRunModeArgs,
  handleRun,
  handleStatus,
  handleDebug,
  runCli,
};
