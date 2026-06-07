---
status: temporary
last_verified: 2026-06-06
---

# Captured Rules - Pending Review

Rules automatically captured from conversations. Review and promote to permanent
storage when confirmed.

---

## Pending Rules

### 2026-06-07 14:46 CEST - Tools: Codex GPT Image Asset Generation

**User said:**

> "not proper gpt-image-2: why do i have to repeat myself all the time?"
> "OPENAI_API_KEY: you dont fucking need it. it's inside codex."
> "fair enough but never generate shitty assets then. i dont want svg garbage shit."

**Rule extracted:**

- **Type**: ALWAYS
- **Action**: When the user asks for generated runtime art, use Codex's built-in image generation path and do not block on `OPENAI_API_KEY`, do not substitute procedural/SVG placeholder generation, and do not downgrade to low-quality temporary assets. Keep model/provenance labels honest.
- **Context**: Deadrot runtime asset generation, especially game sprites, map props, pickups, and other generated bitmap assets.
- **Category**: tools

**Status**: PENDING_REVIEW

---

### 2026-06-06 - Workflow: PR Review And Package Security

**User said:**

> "Install coderabbit and chatgpt review on the repo. They should both review my PRs. Also, we need socket for packages security"

**Rule extracted:**

- **Type**: ALWAYS
- **Action**: Configure PRs for both CodeRabbit and Codex/ChatGPT review, and
  cover package supply-chain changes with Socket.
- **Context**: Deadrot repository pull request and package security workflow.
- **Category**: workflow

**Status**: PENDING_REVIEW

---

## Processed Rules
