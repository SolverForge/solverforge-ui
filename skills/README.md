# solverforge-ui agent skill

`solverforge-ui/SKILL.md` is a portable [Agent
Skill](https://opencode.ai/docs/skills/) that teaches a coding agent how to
build and extend the web UI of a SolverForge app using the shipped
`SF.*` components, without forking the model or the backend.

It is harness-agnostic: the same `SKILL.md` folder is discovered by opencode
(`.opencode/skills`, `~/.config/opencode/skills`), Claude Code
(`.claude/skills`, `~/.claude/skills`), Codex and other Agent Skills harnesses
(`.agents/skills`, `~/.agents/skills`).

## Install

```sh
# Global: every harness that scans a user skill directory
./scripts/install-skill

# Only one harness
./scripts/install-skill --only opencode
./scripts/install-skill --only claude
./scripts/install-skill --only agents

# Into a specific scaffolded app (project-scoped)
./scripts/install-skill --project ../my-scheduler

# Copy instead of symlink, then uninstall/list
./scripts/install-skill --copy
./scripts/install-skill --list
./scripts/install-skill --uninstall
```

The default is a symlink, so the installed skill tracks this checkout. Restart
the agent after installing so it rescans skill directories.

From the repo root, `make install-skill` runs the same script.

## What it covers

- Reading a `solverforge-cli` scaffold and extending its thin neutral shell.
- Choosing between the rail timeline, Gantt, map module, rail primitives, and
  tables for a given optimization shape.
- Mapping generated entities, facts, scalar/list variables, and constraints onto
  component models (integer-minute axes, lanes, items, overlays, tones,
  unassigned work).
- The `SF.createBackend`/`SF.createSolver` lifecycle contract and the rules that
  keep it correct.
- Validating the result in a real browser.

The library's `README.md` remains the authoritative API contract; the skill is a
playbook over it. Keep both in sync when the public API changes.
