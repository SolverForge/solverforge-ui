# PRD: Production-Grade Scheduling Timeline in `SF.rail.createTimeline()`

## Summary
`solverforge-ui` already has the correct canonical surface for read-only scheduling:

- `SF.rail.createTimeline(config)`

That decision is final. This PRD is not about inventing another API. It is about turning the existing timeline into a polished, production-grade scheduling library for dense resource-lane visualization.

The first proving consumer is `solverforge-hospital`, but this PRD is library-first. The timeline must become generically strong enough for future SolverForge quickstarts without becoming hospital-specific.

The implementation agent for this work should assume:

- the public entrypoint stays `SF.rail.createTimeline()`
- `SF.rail` remains the one canonical namespace for resource-lane scheduling
- `SF.gantt` remains separate and unchanged
- the component stays read-only in this pass

## Current Baseline
The shipped timeline already provides:

- numeric-only model input
- sticky top time header
- sticky left lane labels
- synchronized header/body horizontal viewport
- hidden native scrollbar
- drag-to-pan
- zoom presets
- weekend shading
- six-hour tick marks
- overlays
- `overview` and `detailed` lane modes
- packed detailed lanes
- cluster expansion support

This is the correct foundation. The remaining problem is polish and density semantics, not surface selection.

## Product Goal
Make `SF.rail.createTimeline()` a production-grade scheduling timeline for dense resource-lane schedules.

Production-grade means:

1. It remains the single canonical scheduling API in the library.
2. It is visually readable for dense schedules, not just technically correct.
3. It has a clear ownership boundary between library responsibilities and consumer responsibilities.
4. It has explicit behavior for overview aggregation, detailed precision, accessibility, responsiveness, and performance.
5. It is documented and tested as a reusable library component, not a hospital one-off.

## Non-Goals
This pass does not include:

- a new top-level scheduling namespace
- direct editing, drag-rescheduling, or resizing
- timestamp parsing inside the library
- timezone policy inside the library
- a stacked mobile timeline mode
- preserving or adding app-side custom layout engines
- another “simple timeline” surface parallel to `SF.rail.createTimeline()`

## Design Principles

### 1. One canonical scheduling surface
There must be exactly one shared scheduling surface in the library:

- `SF.rail.createTimeline()`

Do not add:

- `SF.schedule`
- `SF.timeline`
- `SF.scheduler`
- or any second scheduling family

Low-level rail helpers may remain, but only as primitives.

### 2. The library owns scheduling semantics
The shared component, not the app, must own:

- overview clustering behavior
- overview summary rendering
- detailed interval packing
- lane height computation
- overlay rendering
- sticky-axis behavior
- drag-pan behavior
- zoom behavior
- viewport synchronization
- density rules

### 3. The consumer owns domain semantics
The consuming app must own:

- timestamp normalization into numeric minutes
- timezone interpretation
- lane ordering policy
- mapping domain facts into badges, stats, overlays, tones, and labels

The library stays numeric-axis only.

### 4. Dense schedules must be readable at a glance
An overview lane must not degrade into a ribbon of tiny colored labels.

The component must provide a real overview representation for dense schedules:

- compact aggregate blocks
- visible count/state information
- optional expansion to exact detail

### 5. Detailed schedules must remain precise
A detailed lane must show actual assignments with stable vertical packing.

No fallback to:

- one fixed strip
- arbitrary card slots
- hidden overlap ambiguity

## Public API Contract
The public entrypoint remains:

- `SF.rail.createTimeline(config)`

Returned API remains:

- `el`
- `setModel(model)`
- `setViewport(viewport)`
- `expandCluster(laneId, clusterId | null)`
- `destroy()`

The goal is to improve the behavior behind this API, not replace it.

## Model Contract
The library continues to accept a normalized numeric model only.
Every time-bearing field is integer-minute only; the library does not coerce
fractional minutes, timestamps, or numeric strings.

### Axis
`model.axis` contains:

- `startMinute`
- `endMinute`
- `days[]`
- `ticks[]`
- `initialViewport`

### Lanes
`model.lanes[]` contains:

- `id`
- `label`
- optional `badges`
- optional `stats`
- optional `overlays`
- `mode: 'overview' | 'detailed'`
- `items[]`

### Items
Base item contract remains:

- `id`
- `startMinute`
- `endMinute`
- `label`
- optional `meta`
- `tone`
- optional `clusterId`
- optional `detailItems[]`

If a consumer provides `clusterId`, each lane may resolve that value to at most
one overview group. Reusing the same `clusterId` for disjoint groups in the
same lane is invalid because it makes `expandCluster(laneId, clusterId)`
ambiguous.

### Additive overview-summary contract
To make overview lanes production-grade, add optional summary fields for aggregated display:

- `summary`
  - optional `primaryLabel`
  - optional `secondaryLabel`
  - optional `count`
  - optional `openCount`
  - optional `toneSegments[]`

Where:

- `toneSegments[]` is an optional additive visualization hint, not a domain type
- each segment is:
  - `tone`
  - `count`

If `summary` is absent, the library must compute a sensible default from clustered detail items.
If a group mixes summarized and unsummarized items, the library must combine
explicit summary fields with derived count/open/tone data from the remaining
grouped items rather than switching to a summary-only aggregate mode.
If an item overrides aggregate `count` beyond the concrete backing items the
library can inspect, omitted `openCount` and omitted `toneSegments` must remain
unknown instead of being guessed from the shell item.

This is additive. Do not require consumer apps to provide it up front.

### Overlays
Overlay contract remains numeric and generic:

- span overlays via `startMinute/endMinute`
- day overlays via `dayIndex/dayCount`

The library must not assume hospital-specific overlay names.

## Functional Requirements

### A. Overview lane behavior
Overview mode must become a first-class dense schedule representation.

Requirements:

- overlapping and tightly adjacent items must collapse into aggregate blocks
- aggregate blocks must show useful summary information directly in the block
- aggregate blocks must visually encode:
  - count
  - open/unassigned state when supplied or inferable
  - tone composition when supplied or inferable
- aggregate blocks must expand inline into packed detailed items
- the expanded aggregate block must remain visible and act as the in-place collapse affordance
- only one expanded cluster per lane at a time
- expansion must preserve row alignment and viewport continuity

Forbidden behavior:

- overview mode rendering every raw item label in dense lanes
- overview blocks using only “first item wins” as the visual summary
- overview blocks that are visually indistinguishable from ordinary detailed items

### B. Detailed lane behavior
Detailed mode must remain precise.

Requirements:

- interval partitioning per lane
- stable track indices
- lane height computed from packed tracks
- overlapping items always visually separated
- packed items remain readable at dense but supported widths

Forbidden behavior:

- one global strip for all items in a lane
- arbitrary fixed slot positions
- item overlap ambiguity

### C. Visual density contract
The timeline must have an explicit dense-schedule visual contract.

At dense staffing scale:

- overview lanes are for scanability
- detailed lanes are for precision
- labels degrade gracefully instead of becoming confetti
- block summaries must remain legible without expansion

### D. Interaction contract
Keep and harden:

- drag-to-pan from header
- drag-to-pan from body
- hidden native scrollbar
- zoom presets
- sticky header
- sticky labels
- synchronized header/body viewport

The interaction model must feel native and deterministic.

### E. Accessibility contract
Production-grade means accessible by contract, not as an afterthought.

Requirements:

- zoom controls are keyboard reachable
- timeline rows and item blocks participate in a sane focus order
- overview cluster blocks are focusable when expandable
- tooltips or hover-only content have a keyboard/focus equivalent
- visible focus treatment exists for interactive elements
- lane labels and item text remain available to assistive technologies

The timeline may remain visually rich, but it must not be mouse-only.

### F. Performance contract
This PRD must result in a timeline that stays responsive on dense schedules.

Reference validation scenario:

- 28-day horizon
- 100 lanes
- 1500 scheduled items
- mix of overview and detailed lanes

Production-grade expectations:

- first mount is fast enough to feel immediate on a modern developer desktop
- `setModel()` updates do not visibly stall the UI
- horizontal drag-pan remains smooth
- zoom changes do not trigger obvious reflow thrash

The implementation must avoid:

- repeated full-DOM rebuilds during simple viewport changes
- duplicate layout calculations from competing measurement authorities
- layout logic split across incompatible rendering paths

Exact perf thresholds may be tuned during implementation, but the agent must add a concrete validation harness or repeatable scenario for this dataset scale.

## Internal Architecture Requirements

### 1. One layout path
There must be one canonical timeline layout pipeline:

1. normalize model
2. measure viewport
3. derive layout
4. derive lane render data
5. render DOM

Do not preserve multiple competing layout branches.

### 2. One measurement authority
The actual body scroller remains the only width authority:

- `.sf-rail-timeline-body-viewport`

No parent-width heuristics.
No guessed initial widths.
No wrapper-width fallback branch.

### 3. Separate render concerns cleanly
Internally, the implementation should clearly separate:

- model normalization
- overview grouping/summary derivation
- detailed packing
- DOM rendering
- interaction/viewport state

This is not for public API reasons. It is to keep the one canonical implementation maintainable.

### 4. Preserve primitive rail APIs without making them the main path
The low-level `SF.rail` helpers may remain public, but:

- they are documented as primitives
- they are not the recommended integration path for dense scheduling
- no new scheduling capability should be implemented only in the primitive path

## Hospital Consumer Requirements
The new implementation must directly support the hospital app as first consumer.

Required successful outcomes:

- `By location` is readable as an overview
- `By employee` is readable as a detailed inspection view
- duplicate employee names remain distinguishable through app-supplied badges/labels
- unassigned work remains visible
- employee overlays work for unavailable / undesired / desired spans
- the schedule no longer looks like a band of arbitrary colored cards

The library must support this without becoming hospital-schema-aware.

## Documentation Requirements
Update the library docs so a new consumer can use the component correctly without reverse-engineering hospital.

Required docs updates:

- `README.md`
  - `SF.rail.createTimeline()` is the canonical scheduling surface
  - numeric-only contract remains explicit
  - overview vs detailed lane guidance is explicit
  - additive `summary` contract is documented
  - dense schedule example is included
- `WIREFRAME.md`
  - reflects shipped behavior, not aspirational old behavior
  - explains the dense schedule visual model clearly
- demo/example material
  - include one dense staffing/resource schedule example
  - include one example with overview expansion and overlays

## Test Plan

### Unit and normalization tests
- numeric validation remains strict
- overview summary normalization accepts additive `summary`
- cluster grouping behavior is deterministic
- detailed packing yields stable track indices
- overlay normalization remains correct

### DOM/render tests
- overview blocks render count/open state when available
- overview expansion is reversible from the same in-UI cluster block
- overview expansion swaps only the selected local cluster into detailed items
- detailed lanes render packed items with non-overlapping vertical positions
- sticky header and sticky labels remain intact
- header/body viewport sync remains correct
- drag-pan works from header and body
- zoom controls update viewport correctly

### Accessibility tests
- zoom controls are keyboard reachable
- cluster blocks are focusable when expandable
- keyboard interaction can reveal the same information as hover
- focus styling and accessible text are present

### Visual acceptance tests
Produce and validate screenshots for:

1. dense location overview
2. expanded location cluster
3. detailed employee lane view
4. narrow but supported viewport

These screenshots are part of acceptance, not optional nice-to-haves.

### Consumer validation
Validate against a hospital-like schedule:

- 28 days
- 100 employees
- 1500 shifts

Acceptance conditions:

- overview remains scannable
- detailed lanes remain precise
- no lane appears as a random ribbon of blocks
- no app-side custom layout engine is required

## Acceptance Criteria
This work is complete only when all of the following are true:

1. `SF.rail.createTimeline()` is still the one canonical scheduling API.
2. Overview lanes are genuinely useful for dense schedules.
3. Detailed lanes remain precise and packed correctly.
4. The library, not the app, owns scheduling layout semantics.
5. The app only supplies numeric model data and domain mapping.
6. Accessibility is intentionally supported.
7. Dense hospital-like schedules are readable in both overview and detail views.
8. Documentation matches shipped behavior.
9. No second scheduling namespace or compatibility rendering path is introduced.

## Explicit Non-Negotiables for the Implementing Agent

- Do not add a new top-level scheduling namespace.
- Do not move scheduling layout logic back into the hospital app.
- Do not add timestamp parsing or timezone policy to the library.
- Do not preserve a second hidden layout algorithm “for compatibility.”
- Do not solve dense overview readability by showing every item label at once.
- Do not call the work complete without screenshot-level visual validation.
