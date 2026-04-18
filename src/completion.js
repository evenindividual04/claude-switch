'use strict';

const { listSelectableProviders, listSupportedCommands } = require('./env');

function providerTokens() {
  return listSelectableProviders()
    .flatMap((provider) => provider.selectorTokens)
    .join(' ');
}

function commandTokens() {
  return listSupportedCommands().join(' ');
}

function generateZshCompletion(binName = 'claude-switch') {
  const providers = providerTokens();
  const commands = commandTokens();

  return `#compdef ${binName}
_${binName}() {
  local -a commands
  commands=(${commands})

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "$words[2]" in
    run|debug|probe)
      _values 'providers' ${providers}
      ;;
    completion)
      _values 'shell' bash zsh fish
      ;;
  esac
}
_${binName} "$@"
`;
}

function generateBashCompletion(binName = 'claude-switch') {
  const providers = providerTokens();
  const commands = commandTokens();

  return `_${binName}() {
  local cur prev
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands}" -- "$cur") )
    return 0
  fi

  case "${COMP_WORDS[1]}" in
    run|debug|probe)
      COMPREPLY=( $(compgen -W "${providers}" -- "$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      ;;
  esac
}
complete -F _${binName} ${binName}
`;
}

function generateFishCompletion(binName = 'claude-switch') {
  const providers = providerTokens().split(' ');
  const commands = listSupportedCommands();

  const lines = [];
  for (const command of commands) {
    lines.push(`complete -c ${binName} -f -n '__fish_use_subcommand' -a '${command}'`);
  }

  for (const provider of providers) {
    lines.push(`complete -c ${binName} -f -n '__fish_seen_subcommand_from run debug probe' -a '${provider}'`);
  }

  lines.push(`complete -c ${binName} -f -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'`);

  return `${lines.join('\n')}\n`;
}

function renderCompletion(shell, binName = 'claude-switch') {
  if (shell === 'zsh') {
    return generateZshCompletion(binName);
  }

  if (shell === 'bash') {
    return generateBashCompletion(binName);
  }

  if (shell === 'fish') {
    return generateFishCompletion(binName);
  }

  return null;
}

module.exports = {
  renderCompletion,
};
