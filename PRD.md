# PRD: Shipped Scheduling Timeline Contract in `SF.rail.createTimeline()`

## Status

Implemented in the current `0.6.4` release line.

This document is now a current-state product contract, not a future
implementation plan. `README.md` remains the public API source of truth, and
`WIREFRAME.md` remains the component-level visual and DOM reference.

## Summary

`solverforge-ui` ships one canonical read-only scheduling surface:

- `SF.rail.createTimeline(config)`

The component is a generic dense scheduling timeline for SolverForge
applications. It is intentionally numeric-axis only: consumers normalize domain
timestamps, time zones, lane ordering, labels, badges, stats, overlays, and
tones before passing a model to the library.

The low-level rail helpers remain shipped primitives for custom furnace-style
resource layouts, but they are not the recommended dense scheduling integration
path.

## Public API Contract

The public entrypoint is:

- `SF.rail.createTimeline(config)`

Returned API:

- `el`
- `setModel(model)`
- `setViewport(viewport)`
- `expandCluster(laneId, clusterId | null)`
- `destroy()`

The component is read-only. It does not parse timestamps, own timezone policy,
or support direct drag-rescheduling in this release line.

## Model Contract

The model must already be normalized to integer minutes.

Rejected inputs include:

- string timestamps
- `Date` objects
- numeric strings
- fractional minutes
- malformed tick objects
- malformed overlay spans

Required model shape:

- `model.axis`: `startMinute`, `endMinute`, `days[]`, `ticks[]`, `initialViewport`
- `model.lanes[]`: `id`, `label`, optional `badges`, optional `stats`,
  optional `overlays`, `mode`, `items[]`
- `items[]`: `id`, `startMinute`, `endMinute`, `label`, optional `meta`,
  optional `summary`, `tone`, optional `clusterId`, optional `detailItems[]`

Each lane may produce at most one overview group for a given `clusterId`.
Reusing the same `clusterId` for disjoint groups in the same lane is invalid
because `expandCluster(laneId, clusterId)` would be ambiguous.

## Shipped Behavior

### Overview Lanes

Overview mode is for scanning dense schedules.

Shipped behavior:

- overlapping or tightly adjacent overview items collapse into aggregate blocks
- aggregate blocks can show direct summary labels, count, open state, and tone
  composition
- omitted summary fields are derived only when backing detail is available
- omitted `openCount` and `toneSegments` stay unknown when the supplied
  aggregate `count` exceeds inspectable backing items
- expanded clusters remain inline and keep the aggregate block visible as the
  collapse affordance
- focus and hover expose equivalent tooltip content

### Detailed Lanes

Detailed mode is for exact inspection.

Shipped behavior:

- detailed blocks preserve exact interval geometry
- adjacent intervals stay visually disjoint on one track
- true overlaps are packed onto separate track rows
- lane height follows the number of packed tracks
- timeline-specific minimum-width inflation is not applied to detailed blocks

### Viewport And Layout

Shipped behavior:

- sticky time header
- sticky lane labels
- one scrollable body viewport for dense solved schedules
- synchronized horizontal header/body movement
- drag-to-pan from the timeline viewport
- weekend shading and overlay bands behind schedule content
- `zoomPresets` defaults to `['1w', '2w', '4w', 'reset']`
- `zoomPresets: []` intentionally removes zoom controls for fixed-horizon
  app surfaces
- `labelWidth` defaults to `280`
- supported embeds with a body viewport of `500px` or wider compact the label
  column when needed to preserve at least `320px` of visible schedule track
- timelines created or updated before DOM attachment resynchronize layout after
  mount

## Validation Surface

The shipped validation surface includes:

- Node frontend tests for numeric-only normalization, overview grouping,
  detailed packing, cluster identity, viewport sync, zoom controls, detached
  mount resync, and dense fixture rendering
- browser smoke tests for `demos/full-surface.html`,
  `demos/timeline.html`, `demos/timeline-dense.html`, and `demos/rail.html`
- acceptance screenshots under `screenshots/`
- README and wireframe coverage for the public contract

Use these focused commands while working on the timeline:

```bash
make lint-frontend
make test-frontend
make test-browser
```

Use `make test-quick` or `make test` before release work.

## Documentation Requirements

Whenever `SF.rail.createTimeline()` behavior changes, update the same release
surface together:

- `README.md`
- `WIREFRAME.md`
- `demos/README.md`
- runnable demos under `demos/`
- focused tests under `tests/`
- generated assets under `static/sf/`

Do not document planned scheduling behavior as shipped unless it is wired into
the generated assets and covered by README API reference text.

## Non-Negotiables

- Do not add a second scheduling namespace such as `SF.schedule`,
  `SF.timeline`, or `SF.scheduler`.
- Do not move shared scheduling layout semantics back into a consuming app.
- Do not add timestamp parsing or timezone policy to the library.
- Do not add compatibility-only layout branches.
- Do not make overview readability depend on showing every raw item label at
  once.
- Do not call a timeline behavior shipped without tests, demos, docs, and
  generated assets staying synchronized.
