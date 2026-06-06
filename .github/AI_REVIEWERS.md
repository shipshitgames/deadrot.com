# AI Reviewers And Package Security

This repo is configured so PRs can be reviewed by both CodeRabbit and OpenAI
Codex/ChatGPT, with Socket covering package supply-chain checks.

## Repo Configuration

- CodeRabbit reads `.coderabbit.yaml` from the repository root. Automatic review
  is enabled for the default branch plus `develop` and `staging`; draft PRs are
  skipped.
- Codex/ChatGPT reads `AGENTS.md` review guidance. Automatic review itself is
  enabled from ChatGPT/Codex settings, not from a repository file.
- Socket CI runs from `.github/workflows/socket.yml` on same-repo PRs and pushes
  to `master`, `develop`, and `staging`.

## Required External Setup

These steps require account or GitHub App authorization and cannot be completed
by committing files alone.

1. Install CodeRabbit on this repository:
   `https://github.com/apps/coderabbitai`
2. Enable Codex code review for this repository:
   `https://chatgpt.com/codex/settings/code-review`
3. Install Socket Security on this repository:
   `https://github.com/apps/socket-security`
4. Add the Socket Actions secret after creating a Socket CI/CD API key:
   `SOCKET_SECURITY_API_KEY`

For the Socket CI secret, use a repository or organization Actions secret. The
workflow intentionally fails when the secret is missing so package security is
not silently skipped on protected branches.

## Manual Review Triggers

- CodeRabbit: comment `@coderabbitai review` on a pull request.
- Codex/ChatGPT: comment `@codex review` on a pull request.
- Codex/ChatGPT focused security pass: comment
  `@codex review for security vulnerabilities and dependency risk`.
