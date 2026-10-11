#!/usr/bin/env bash
#
# create-worktree.sh — create a git worktree for a GitHub issue/PR.
#
# Usage:
#   create-worktree.sh <issue-ref> [type]
#
#   <issue-ref>  A GitHub issue or PR reference, in any of these forms:
#                  https://github.com/owner/repo/issues/65
#                  https://github.com/owner/repo/pull/65
#                  owner/repo#65
#                  #65
#                  65
#   [type]       Branch prefix. Default: feat
#
# Behaviour:
#   - Resolves the issue/PR title via the GitHub API and slugifies it.
#   - Branch name:  <type>/<number>-<slug>     e.g. feat/65-add-login-screen
#   - Base branch:  master -> main -> develop  (first that exists wins)
#   - Worktree dir: <worktree home>/<owner-repo>/<branch-with-slashes-as-dashes>
#                   NEVER inside the repository. The home is chosen by the global
#                   `git wt` helper (~/.claude/worktrees, ~/.codex/worktrees,
#                   ~/.grok/worktrees, else ~/worktrees); GIT_WT_HOME overrides it.
#                   Without `git wt`, this script applies the same layout itself.
#   - Prints WORKTREE_PATH=<abs-path> and BRANCH=<name> on the last lines.
#
# Requires: git, gh (authenticated).

set -euo pipefail

die() { printf 'worktree: %s\n' "$1" >&2; exit 1; }

[ "$#" -ge 1 ] || die "missing issue reference. Usage: create-worktree.sh <issue-ref> [type]"
command -v git >/dev/null 2>&1 || die "git not found"
command -v gh  >/dev/null 2>&1 || die "gh CLI not found (needed to read the issue title)"

INPUT="$1"
TYPE="${2:-feat}"

# --- Locate the repository root -------------------------------------------
TOPLEVEL="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository"

# --- Extract the issue/PR number ------------------------------------------
NUMBER=""
if   [[ "$INPUT" =~ /(issues|pull)/([0-9]+) ]]; then NUMBER="${BASH_REMATCH[2]}"
elif [[ "$INPUT" =~ \#([0-9]+) ]];               then NUMBER="${BASH_REMATCH[1]}"
elif [[ "$INPUT" =~ ^[0-9]+$ ]];                 then NUMBER="$INPUT"
else NUMBER="$(printf '%s' "$INPUT" | grep -oE '[0-9]+' | tail -1 || true)"
fi
[ -n "$NUMBER" ] || die "could not find an issue/PR number in: $INPUT"

# --- Resolve owner/repo (from the URL, else the current repo) -------------
if [[ "$INPUT" =~ github\.com[:/]+([^/]+)/([^/#[:space:]]+) ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]%.git}"
  NWO="$OWNER/$REPO"
else
  NWO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
    || die "no GitHub repo detected; pass a full issue URL"
fi

# --- Fetch the title (the issues endpoint serves issues AND PRs) ----------
TITLE="$(gh api "repos/$NWO/issues/$NUMBER" --jq .title 2>/dev/null || true)"
[ -n "$TITLE" ] || die "could not read issue/PR #$NUMBER from $NWO (check the number and gh auth)"

# --- Slugify --------------------------------------------------------------
SLUG="$(printf '%s' "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
  | cut -c1-50 \
  | sed -E 's/-+$//')"
[ -n "$SLUG" ] || SLUG="issue"

BRANCH="$TYPE/$NUMBER-$SLUG"
WT_NAME="${BRANCH//\//-}"

# --- Resolve the worktree directory (always outside the repository) --------
# Prefer the global `git wt` helper: it picks the calling agent's shared home,
# enforces the per-repo worktree cap, and syncs .worktreeinclude files.
USE_GIT_WT=0
if WTDIR="$(git wt --path "$WT_NAME" 2>/dev/null)" && [ -n "$WTDIR" ]; then
  USE_GIT_WT=1
else
  # Same layout as git wt: <home>/<owner-repo>/<name>, home = $GIT_WT_HOME or ~/worktrees.
  ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
  ORIGIN_URL="${ORIGIN_URL%/}"
  ORIGIN_URL="${ORIGIN_URL%.git}"
  if [[ "$ORIGIN_URL" =~ ([^/:]+)/([^/:]+)$ ]]; then
    REPO_SLUG="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}"
  else
    REPO_SLUG="$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")"
  fi
  REPO_SLUG="$(printf '%s' "$REPO_SLUG" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9._-' '-')"
  WTDIR="${GIT_WT_HOME:-$HOME/worktrees}/$REPO_SLUG/$WT_NAME"
fi

case "$WTDIR/" in
  "$TOPLEVEL"/*) die "refusing to create a worktree inside the repository: $WTDIR" ;;
esac

# --- Determine the base branch (master -> main -> develop) ----------------
if git remote get-url origin >/dev/null 2>&1; then
  git fetch origin --quiet --prune 2>/dev/null || true
fi

BASE_REF=""
for cand in master main develop; do
  if   git show-ref --verify --quiet "refs/remotes/origin/$cand"; then BASE_REF="origin/$cand"; break
  elif git show-ref --verify --quiet "refs/heads/$cand";          then BASE_REF="$cand";        break
  fi
done
[ -n "$BASE_REF" ] || die "no develop/master/main branch found to base the worktree on"

# --- Create the worktree --------------------------------------------------
if [ -e "$WTDIR" ]; then
  printf 'worktree: %s already exists — reusing it.\n' "$WTDIR" >&2
else
  # git wt takes the worktree name and derives the directory; raw git takes the path.
  if [ "$USE_GIT_WT" -eq 1 ]; then ADD=(git wt); TARGET="$WT_NAME"
  else mkdir -p "$(dirname "$WTDIR")"; ADD=(git worktree add); TARGET="$WTDIR"
  fi
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    # Branch already exists: attach a worktree to it without re-creating.
    "${ADD[@]}" "$TARGET" "$BRANCH"
  else
    "${ADD[@]}" -b "$BRANCH" "$TARGET" "$BASE_REF"
  fi
fi

# --- Report ---------------------------------------------------------------
printf '\n'
printf 'Issue/PR : %s#%s — %s\n' "$NWO" "$NUMBER" "$TITLE"
printf 'Base     : %s\n' "$BASE_REF"
printf 'Branch   : %s\n' "$BRANCH"
printf 'BRANCH=%s\n' "$BRANCH"
printf 'WORKTREE_PATH=%s\n' "$WTDIR"
