'use strict';

const PREFIX = '[claude-switch]';

function info(message) {
  console.error(`${PREFIX} ${message}`);
}

function warn(message) {
  console.warn(`${PREFIX} WARNING: ${message}`);
}

function error(message) {
  console.error(`${PREFIX} ERROR: ${message}`);
}

function mode(provider) {
  if (provider === 'ZAI') {
    info('-> Z.AI mode');
    return;
  }

  if (provider === 'MINIMAX') {
    info('-> MiniMax mode');
    return;
  }

  if (provider === 'OLLAMA') {
    info('-> Ollama mode');
    return;
  }

  info('-> Claude (Anthropic)');
}

module.exports = {
  info,
  warn,
  error,
  mode,
};
