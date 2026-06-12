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

## Current Version

- Crate version: `0.7.0`.
- Versioned asset outputs are emitted as `static/sf/sf.<version>.css` and
  `static/sf/sf.<version>.js`.
- `solverforge_ui::assets` is available without default features; the Axum
  `routes()` adapter is available behind the default `axum` feature.

## Solver Lifecycle Contract

- `createJob()` results are normalized before any stream is attached. A valid
  result is a non-empty string id, a finite numeric id including `0`, or an
  object with a scalar `id`, `jobId`, or `job_id` field. Non-scalar ids are
  rejected rather than stringified.
- Startup streams may begin with either a scored `progress` event or a scored
  `best_solution` event.
- `progress` is metadata-only and must not carry the solution payload.
- `best_solution` must include both `solution` and `snapshotRevision`.
- If a backend seeds startup state from a retained snapshot, it must not emit an
  identical duplicate startup `best_solution` immediately after that bootstrap.
- `deleteJob()` is mandatory for every backend passed to `SF.createSolver()`.
  `delete()` is terminal-only destructive backend cleanup, and local retained
  state is cleared only after terminal synchronization and backend deletion
  both succeed. `COMPLETED` and `TERMINATED_BY_CONFIG` retained jobs require
  successful terminal snapshot synchronization before `deleteJob()` is allowed.
- Paused and terminal lifecycle events remain authoritative; `SF.createSolver()`
  synchronizes retained snapshot state before invoking the corresponding
  callbacks.
- HTTP `EventSource.onerror` represents transport state. Reconnecting errors are
  ignored; a closed stream is surfaced through `onError` and preserves the last
  authoritative lifecycle, retained job id, score, metadata, and snapshot
  revision. In-flight states must remain exact: `PAUSE_REQUESTED`,
  `RESUMING`, and `CANCELLING` must not collapse back to `SOLVING` or `IDLE`.
  Stop remains visible during `CANCELLING`; activating it may reattach a closed
  stream to listen for the terminal event, but it must not send a duplicate
  `cancelJob()` call.

## Rail Timeline Contract

- `SF.rail.createTimeline()` is the shipped dense scheduling surface. Keep its
  README API reference, `WIREFRAME.md`, tests, demos, and generated assets
  synchronized whenever timeline config, geometry, scrolling, or layout behavior
  changes.
- `zoomPresets` defaults to `['1w', '2w', '4w', 'reset']`; `[]` intentionally
  removes zoom controls for fixed-horizon app surfaces.
- Detailed timeline items must preserve exact interval geometry. Adjacent
  intervals stay visually disjoint on one track; true overlaps are packed onto
  separate track rows.
- Dense schedules use one scrollable body viewport with synchronized horizontal
  header/body movement. Do not document the body scrollbar as hidden.
- Timeline layout must resynchronize after detached `createTimeline()` or
  `setModel()` calls once the element is mounted.

## Working Rules

- Keep public API changes synchronized across code, `README.md`, runnable demos,
  and tests in the same change.
- Do not hand-edit `CHANGELOG.md` for ordinary work; release notes are generated
  by `commit-and-tag-version` through `make release-tag`.
- Do not document planned or exploratory wireframe ideas as shipped behavior
  until they are wired into the generated assets and the README API reference.
- Prefer `make lint-frontend` for focused JavaScript linting, `make
  test-frontend` or `make test-browser` for focused frontend validation, and
  `make test-quick` or `make test` before release work.
- When the Rust crate feature surface changes, validate both default features
  and `--no-default-features`; the latter must keep `solverforge_ui::assets`
  available without depending on Axum.
