# Contributing

## Workflow

1. Open or select a task.
2. Confirm affected contracts and paths.
3. Create a focused branch/worktree.
4. Implement tests and documentation with the change.
5. Run required checks.
6. Submit a PR using `templates/PR.md`.

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
