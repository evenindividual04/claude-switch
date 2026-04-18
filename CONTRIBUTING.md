# Contributing

Thanks for contributing to `claude-switch`.

## Development Setup

```bash
npm install
npm link
```

## Local Validation

```bash
npm test
```

No formatter or linter is required for contributions in this repository today.

## Contribution Rules

- Keep behavior runtime-only. Do not add config-file mutation behavior.
- Do not add proxy-based routing.
- Keep `claude-switch run` argument passthrough behavior stable.
- Preserve env-precedence safety:
  - Z.AI mode must force `ANTHROPIC_API_KEY=""`
  - Default mode must unset Anthropic override vars
- Prefer small, focused pull requests with tests for behavior changes.

## Pull Request Checklist

- Add/adjust tests for behavior changes.
- Update README when command UX or guarantees change.
- Keep error messages actionable.
