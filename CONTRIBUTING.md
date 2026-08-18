# Contributing

## Workflow

1. Read [README.md](README.md) and run `./setup.sh` for a local host/mobile smoke test when working on runtime or networking behavior.
2. Open or select a task.
3. Confirm affected contracts and paths.
4. Create a focused branch/worktree.
5. Implement tests and documentation with the change.
6. Run required checks.
7. Submit a PR using `templates/PR.md`.

## Required review

- Protocol/schema: protocol owner plus mobile/bridge consumer
- Database: bridge owner plus QA
- Pairing/crypto: security reviewer
- Approval UI: mobile, security, accessibility
- Adapter: adapter owner plus QA

## Compatibility

Do not add direct runtime-specific behavior to mobile. Add a capability or normalized field through the contract process.

## Security

Never include real secrets or proprietary repository content in fixtures. Report vulnerabilities privately through the security contact established before public release.

## Local checks

```bash
pnpm typecheck
pnpm build
pnpm test
```

Keep provider credentials, pairing codes, local databases, native build output, and host config outside Git.
