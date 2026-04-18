# claude-switch

`claude-switch` is a production-safe wrapper around the existing `claude` CLI that switches provider routing at runtime only.

It is designed for this workflow:

- `claude` / `claude code` -> normal Claude (Anthropic)
- `claude z.ai` / `claude code z.ai` -> Claude routed through Z.ai
- `claude minimax` / `claude code minimax` -> Claude routed through MiniMax

No config file edits, no persistent env mutation, no proxy layer.

## Why This Exists

Claude auth precedence can cause conflicts when multiple auth variables are present. `claude-switch` avoids that by constructing a clean per-process environment before spawning the real Claude binary.

Core design choice:

- CLI binary is `claude-switch`
- User adds alias: `alias claude="claude-switch run"`

This avoids replacing the real `claude` binary and prevents PATH recursion issues.

## Installation

### Option 1: From npm (global)

```bash
npm install -g claude-switch
```

### Option 2: Local clone + link

```bash
git clone <repo-url>
cd claude-switch
npm install
npm link
```

## Setup

Add to `~/.zshrc` (or your shell rc):

```bash
alias claude="claude-switch run"
export ZAI_API_KEY="your_zai_key"
```

Reload shell:

```bash
source ~/.zshrc
```

## Quick Start

```bash
claude
claude code
claude z.ai
claude code z.ai
claude minimax
claude code minimax
claude-switch status
claude-switch debug
```

## Commands

- `claude-switch run [args...]`
- `claude-switch run z.ai [args...]`
- `claude-switch run minimax [args...]`
- `claude-switch run code z.ai [args...]`
- `claude-switch run code minimax [args...]`
- `claude-switch status`
- `claude-switch debug [args...]`

Notes:

- `z.ai` is treated as provider selector only in these positions:
  - first arg: `claude z.ai ...`, `claude minimax ...`
  - after `code`: `claude code z.ai ...`, `claude code minimax ...`
- Other arguments are passed through to Claude unchanged.

## Runtime Environment Model

### Default mode (`claude`, `claude code`)

Before spawning Claude, `claude-switch` removes:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_API_KEY`

### Z.ai mode (`claude z.ai`, `claude code z.ai`)

Before spawning Claude, `claude-switch` sets:

- `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`
- `ANTHROPIC_AUTH_TOKEN=$ZAI_API_KEY`
- `ANTHROPIC_API_KEY=""` (forced empty string)

`ZAI_API_KEY` must be non-empty and not whitespace-only.

### MiniMax mode (`claude minimax`, `claude code minimax`)

Before spawning Claude, `claude-switch` sets:

- `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`
- `ANTHROPIC_AUTH_TOKEN=$MINIMAX_API_KEY`
- `ANTHROPIC_API_KEY=""` (forced empty string)

`MINIMAX_API_KEY` must be non-empty and not whitespace-only.

## Safety Guarantees

- Does not modify `~/.claude/settings.json`
- Does not persist environment changes
- Does not run a proxy server
- Does not hijack or overwrite the `claude` binary
- Resolves and spawns the real Claude executable from `PATH`
- Excludes wrapper self-paths to avoid recursion

## Diagnostics

### `claude-switch status`

Prints:

- `Provider`
- `ANTHROPIC_API_KEY` state
- `ANTHROPIC_AUTH_TOKEN` state
- `ANTHROPIC_BASE_URL` state
- `ZAI_API_KEY` state
- `MINIMAX_API_KEY` state

Also emits warnings for common conflict states (for example global `ANTHROPIC_API_KEY` overriding token auth).

### `claude-switch debug`

Prints redacted diagnostics including:

- provider decision
- passthrough argv
- resolved Claude binary
- candidate binaries discovered on `PATH`
- redacted auth-related env values

## Exit Behavior

- Wrapper exits with the same exit code as the spawned Claude process.
- `SIGINT`/`SIGTERM` are forwarded to the child process.
- Common failure cases return non-zero:
  - missing/invalid `ZAI_API_KEY` in Z.ai mode
  - missing/invalid `MINIMAX_API_KEY` in MiniMax mode
  - real `claude` binary not found
  - spawn failure

## Migration (Claude-only -> Mixed Providers)

No settings migration is required. Keep your existing Claude install and add only:

```bash
alias claude="claude-switch run"
export ZAI_API_KEY="your_zai_key"
export MINIMAX_API_KEY="your_minimax_key"
```

Then select provider per invocation:

```bash
claude               # Claude
claude z.ai          # Z.AI
claude minimax       # MiniMax
claude code z.ai     # Claude Code on Z.AI
claude code minimax  # Claude Code on MiniMax
```

## Troubleshooting

### `ERROR: ZAI_API_KEY is required for z.ai mode`

Set the key and reload your shell:

```bash
export ZAI_API_KEY="your_zai_key"
```

### `Unable to find a real "claude" binary on PATH`

Ensure Claude CLI is installed and resolvable:

```bash
command -v claude
```

Also verify your alias is exactly:

```bash
alias claude="claude-switch run"
```

### Unexpected auth behavior

Run:

```bash
claude-switch status
claude-switch debug
```

Look for warnings about `ANTHROPIC_API_KEY` conflicts.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Watch-mode tests:

```bash
npm run test:watch
```

## Contributing

See [CONTRIBUTING.md](/Users/anmolsen/Developer/claude-switch/CONTRIBUTING.md) for contribution guidelines and PR expectations.

## License

MIT. See [LICENSE](/Users/anmolsen/Developer/claude-switch/LICENSE).

## Philosophy

- explicit over implicit
- no hidden state
- no global mutation
- minimal latency
- predictable behavior
