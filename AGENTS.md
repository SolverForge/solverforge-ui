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
- `static/sf/sf.js` and `static/sf/sf.css` are compatibility paths. The
  versioned `static/sf/sf.<version>.js` and `static/sf/sf.<version>.css` files
  are generated release artifacts and must stay in step with the crate version.

## Current Version

- Crate version: `0.9.0`.
- Versioned asset outputs are emitted as `static/sf/sf.<version>.css` and
  `static/sf/sf.<version>.js`.
- `SF.version` in the bundled JavaScript and `assets::version()` report the
  crate version that produced the embedded asset set.
- Stable bundles use a short cache lifetime; versioned bundles, vendor files,
  fonts, and images use immutable caching.
- `solverforge_ui::assets` is available without default features; the Axum
  `routes()` adapter is available behind the default `axum` feature.

## Embedded Asset Contract

- `assets::get(path)` accepts only strict `/sf`-relative paths and returns
  `Result<UiAsset, AssetError>`.
- Empty, absolute, backslash, duplicate-slash, `.` and `..` paths are invalid
  and return `AssetError::InvalidPath`; valid missing paths return
  `AssetError::NotFound`.
- `assets::paths()` returns all embedded file paths in stable sorted order.
- Axum hosts should use `solverforge_ui::routes()` rather than duplicating asset
  lookup, MIME types, or cache policy. Non-Axum hosts should use `assets::get()`.

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
- Snapshot callbacks must tolerate a missing snapshot. Render only when
  `snapshot && snapshot.solution` exists, and synchronize lifecycle markers in
  a `finally` block so cancellation or snapshot failure cannot hide terminal
  state.
- `onProgress(meta)`, `onPauseRequested(meta)`, and `onResumed(meta)` receive
  metadata only. `onSolution(snapshot, meta)`, `onPaused(snapshot, meta)`,
  `onCancelled(snapshot, meta)`, and `onComplete(snapshot, meta)` receive a
  snapshot when one is available. `onFailure(message, meta, snapshot,
  analysis)` may receive null snapshot and analysis values.
- `onAnalysis(analysis, meta)` runs when terminal or paused synchronization
  obtains analysis; `onError(message)` reports transport and synchronization
  failures without inventing a lifecycle transition.
- Applications should expose authoritative state on their root after every
  callback with `data-job-id`, `data-snapshot-revision`, and
  `data-lifecycle-state`; these markers are observability hooks, not a second
  lifecycle implementation.
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
- Timeline minute fields, day indexes, day counts, ticks, and viewport bounds
  are finite integer values. Consumer code owns timestamp and timezone
  normalization before passing data to the timeline.
- Overview `summary` fields are additive. Mixed summarized and raw items keep
  derived counts and tone data where they remain knowable; explicit aggregate
  values are required when a summary overrides the inspectable item count.
- `clusterId` identifies one overview group per lane. Reusing it for disjoint
  groups is invalid, and expansion must use the returned timeline API rather
  than mutating component DOM.

## Working Rules

- Keep public API changes synchronized across code, `README.md`, runnable demos,
  `WIREFRAME.md`, the matching skill in `solverforge-cli`, and tests in the same
  change.
- Edit `js-src/` and `css-src/`, then run `make assets`; never hand-edit stable
  or versioned files under `static/sf/`.
- Do not hand-edit `CHANGELOG.md` for ordinary work; release notes are generated
  by `commit-and-tag-version` through `make release-tag`.
- Do not document planned or exploratory wireframe ideas as shipped behavior
  until they are wired into the generated assets and the README API reference.
- The `solverforge-ui` agent skill lives in `SolverForge/solverforge-cli`
  (`skills/solverforge-ui/`) and ships with the `solverforge-cli` package. When a
  shipped component, lifecycle rule, timeline/model contract, or integration path
  changes, update the skill there in the same effort.
- Prefer `make lint-frontend` for focused JavaScript linting, `make
  test-frontend` or `make test-browser` for focused frontend validation, and
  `make test-quick` or `make test` before release work.
- `make bump-version VERSION=x.y.z` synchronizes Cargo metadata, runtime
  version strings, documentation, skill metadata, and generated versioned
  bundles. Run the release tool only after the version surfaces and release
  checks are clean.
- When the Rust crate feature surface changes, validate both default features
  and `--no-default-features`; the latter must keep `solverforge_ui::assets`
  available without depending on Axum.
