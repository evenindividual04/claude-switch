# claude-switch

`claude-switch` is a production-safe wrapper around the existing `claude` CLI that switches providers at runtime only.

Primary flow:

- `claude` / `claude code` -> Claude (Anthropic)
- `claude z.ai` / `claude code z.ai` -> Z.AI
- `claude minimax` / `claude code minimax` -> MiniMax
- `claude ollama` / `claude code ollama` -> Ollama

No config-file mutation for provider switching, no proxy, no persistent active-provider state.

## Installation

```bash
npm install -g claude-switch
```

Local clone:

```bash
git clone <repo-url>
cd claude-switch
npm install
npm link
```

## Setup

```bash
alias claude="claude-switch run"
export ZAI_API_KEY="your_zai_key"
export MINIMAX_API_KEY="your_minimax_key"
# Optional for ollama; fallback token is "ollama"
export OLLAMA_API_KEY="your_ollama_key"
```

## Commands

- `claude-switch run [provider-token] [--profile minimal|strict] [claude-args...]`
- `claude-switch status`
- `claude-switch debug [provider-token] [--profile minimal|strict] [claude-args...]`
- `claude-switch doctor`
- `claude-switch probe <provider-token>`
- `claude-switch cache <usage|health|clear> [args]`
- `claude-switch completion <bash|zsh|fish>`

Provider tokens:

- `z.ai`
- `minimax`
- `ollama`

Selector semantics:

- first token: `claude z.ai ...`, `claude minimax ...`, `claude ollama ...`
- after `code`: `claude code z.ai ...`, `claude code minimax ...`, `claude code ollama ...`

## Runtime env model

### Claude default mode

Removes:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- model-tier mapping vars

### Z.AI mode

Sets:

- `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`
- `ANTHROPIC_AUTH_TOKEN=$ZAI_API_KEY`
- `ANTHROPIC_API_KEY=""`

Requires non-empty `ZAI_API_KEY`.

Optional endpoint override:

- `ZAI_BASE_URL`

### MiniMax mode

Sets:

- `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`
- `ANTHROPIC_AUTH_TOKEN=$MINIMAX_API_KEY`
- `ANTHROPIC_API_KEY=""`

Requires non-empty `MINIMAX_API_KEY`.

Optional endpoint override:

- `MINIMAX_BASE_URL`

### Ollama mode

Sets:

- `ANTHROPIC_BASE_URL=http://localhost:11434`
- `ANTHROPIC_AUTH_TOKEN=${OLLAMA_API_KEY:-ollama}`
- `ANTHROPIC_API_KEY=""`

Optional endpoint override:

- `OLLAMA_BASE_URL`

## Profiles

- `minimal` (default): auth + base URL only
- `strict`: also injects model-tier mapping vars

Model-tier env vars:

- `ANTHROPIC_DEFAULT_OPUS_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- `ANTHROPIC_SMALL_FAST_MODEL`

Provider defaults for `strict`:

- Z.AI: `GLM-4.7`, `GLM-4.7`, `GLM-4.5-Air`, `GLM-4.5-Air`
- MiniMax: `MiniMax-M2.1` for all tiers
- Ollama: only set when `OLLAMA_MODEL` is provided

Profile selection:

```bash
claude z.ai --profile strict
# or
CLAUDE_SWITCH_PROFILE=strict claude z.ai
```

## Diagnostics

### status

Shows:

- provider intent
- auth/env conflict state
- base host
- profile
- key detection (`ZAI_API_KEY`, `MINIMAX_API_KEY`, `OLLAMA_API_KEY`)
- model-tier mapping summary

### debug

Shows:

- selector consumed + resolved provider id
- real `claude` binary candidates and final selection
- redacted provider keys
- effective env delta

### doctor

Checks:

- real `claude` binary resolution
- alias guidance
- required provider keys
- base URL override validity
- conflict warnings

### probe

Connectivity probe with short timeout for a provider endpoint.

Examples:

```bash
claude-switch probe z.ai
claude-switch probe minimax
claude-switch probe ollama
```

### cache

Write optional cache files consumed by statusline segments:

```bash
claude-switch cache usage --provider z.ai --percentage 74 --label quota
claude-switch cache health --provider z.ai --status ok --latency-ms 120
claude-switch cache clear --target all
```

Cache file paths can be overridden:

- `PROVIDER_USAGE_CACHE_FILE`
- `PROVIDER_HEALTH_CACHE_FILE`

## Completion

Generate shell completion:

```bash
claude-switch completion zsh
claude-switch completion bash
claude-switch completion fish
```

## Exit codes

- `0` success
- `1` unknown error
- `2` invalid usage
- `3` missing credential
- `4` invalid provider token
- `5` claude binary not found
- `6` spawn failed
- `7` probe/doctor failure

## Migration (Claude-only -> mixed providers)

No settings migration is required. Keep your Claude install and add alias + keys.

```bash
claude               # Claude
claude z.ai          # Z.AI
claude minimax       # MiniMax
claude ollama        # Ollama
claude code z.ai     # Claude Code on Z.AI
claude code minimax  # Claude Code on MiniMax
claude code ollama   # Claude Code on Ollama
```

## Safety guarantees

- does not modify `~/.claude/settings.json` for provider state
- does not persist runtime env changes
- does not proxy traffic
- does not overwrite the real `claude` binary
- resolves and spawns real `claude` from `PATH`

## Development

```bash
npm test
npm run test:watch
```

## Contributing

See [CONTRIBUTING.md](/Users/anmolsen/Developer/claude-switch/CONTRIBUTING.md).

## License

MIT. See [LICENSE](/Users/anmolsen/Developer/claude-switch/LICENSE).
