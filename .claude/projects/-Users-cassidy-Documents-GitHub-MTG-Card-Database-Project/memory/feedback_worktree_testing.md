---
name: Test in main project, not worktree
description: User runs the app from the main project directory, not from the worktree
type: feedback
---

When fixes are applied only to a worktree, the user won't see them — they open `index.html` directly from the main project directory (`/Users/cassidy/Documents/GitHub/MTG Card Database Project/index.html`), not from the worktree path.

**Why:** The app is a static file opened in a browser via `file://` — there's no dev server, so the worktree path is never in play unless explicitly navigated to.

**How to apply:** Always apply fixes to both the main project file and the worktree, or confirm with the user which file they're testing against before assuming the worktree is enough.
