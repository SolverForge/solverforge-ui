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

The installer copies the skill into each selected harness's **own** skills
directory. There is no symlink and no shared/central location, so every harness
gets an independent, self-contained copy.

Each installed copy includes an ownership receipt recording the copied payload.
Updates and uninstalls proceed only when that receipt is valid and the installed
files are unchanged. An unmanaged directory, an invalid receipt, or local
customizations are reported and left untouched; resolve those conflicts manually
before rerunning the command.

```sh
# Default: user scope for opencode, Claude Code, and the Agent Skills standard
./scripts/install-skill

# Explicitly choose harnesses
./scripts/install-skill --only opencode
./scripts/install-skill --only claude
./scripts/install-skill --only agents

# Into a specific scaffolded app; each harness gets its own project directory
./scripts/install-skill --project ../my-scheduler

# Any other skills directory you want
./scripts/install-skill --dir ~/.config/some-harness/skills

# Inspect or remove
./scripts/install-skill --list
./scripts/install-skill --uninstall
```

| Harness | User scope | Project scope (`--project <dir>`) |
| --- | --- | --- |
| opencode | `~/.config/opencode/skills` | `<dir>/.opencode/skills` |
| Claude Code | `~/.claude/skills` | `<dir>/.claude/skills` |
| Agent Skills | `~/.agents/skills` | `<dir>/.agents/skills` |

Restart the agent after installing so it rescans skill directories. From the
repo root, `make install-skill` runs the same script.

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
