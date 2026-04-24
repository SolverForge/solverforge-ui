# AGENTS

Repository guidance for coding agents and maintainers working in
`solverforge-ui`.

## Scope

- `README.md` is the source of truth for shipped public API and runtime
  contracts.
- `WIREFRAME.md` can include shipped and planned UI, but every section must
  clearly distinguish which is which.
- `js-src/` and `css-src/` are the editable sources. `static/sf/` contains the
  generated bundled assets served to consumers.

## Current Release

- Crate version: `0.6.0`.
- Versioned asset outputs are emitted as `static/sf/sf.<version>.css` and
  `static/sf/sf.<version>.js`.

## Solver Lifecycle Contract

- Startup streams may begin with either a scored `progress` event or a scored
  `best_solution` event.
- `progress` is metadata-only and must not carry the solution payload.
- `best_solution` must include both `solution` and `snapshotRevision`.
- If a backend seeds startup state from a retained snapshot, it must not emit an
  identical duplicate startup `best_solution` immediately after that bootstrap.
- `deleteJob()` is mandatory for every backend passed to `SF.createSolver()`.
  `delete()` is terminal-only destructive backend cleanup, and local retained
  state is cleared only after backend deletion succeeds.
- Paused and terminal lifecycle events remain authoritative; `SF.createSolver()`
  synchronizes retained snapshot state before invoking the corresponding
  callbacks.
- HTTP `EventSource.onerror` represents transport state. Reconnecting errors are
  ignored; a closed stream is surfaced through `onError` and preserves the last
  authoritative lifecycle, retained job id, score, metadata, and snapshot
  revision. In-flight states must remain exact: `PAUSE_REQUESTED`,
  `RESUMING`, and `CANCELLING` must not collapse back to `SOLVING` or `IDLE`.

## Working Rules

- Keep public API changes synchronized across code, `README.md`, runnable demos,
  and tests in the same change.
- Do not document planned or exploratory wireframe ideas as shipped behavior
  until they are wired into the generated assets and the README API reference.
- Prefer `make lint-frontend` for focused JavaScript linting, `make
  test-frontend` or `make test-browser` for focused frontend validation, and
  `make test-quick` or `make test` before release work.
