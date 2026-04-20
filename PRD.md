# PRD: Production Hardening for `SF.rail.createTimeline()`

This PRD supersedes the previous `PRD.md`.

The prior PRD was about introducing `SF.rail.createTimeline()` as the canonical
read-only scheduling surface. That API now exists. This document replaces the
introduction-focused PRD with a hardening-focused PRD for the shipped timeline.

The target is a production-grade component with one canonical layout path, one
measurement authority, and one strict numeric input contract. Do not preserve
compatibility branches, guessed widths, or coercive parsing behavior.

## Summary

`SF.rail.createTimeline()` must render the same time density from the actual
horizontal scroll viewport regardless of parent padding, card chrome, grid
gutters, or flex context.

It must also preserve a usable visible schedule track at every supported embed
width without introducing a second presentation mode, a stacked fallback, or
legacy layout branches.

The component remains read-only. The public API shape stays the same. The work
is a contract hardening pass, not a new feature surface.

## Problem Statement

The current implementation has two production blockers:

1. Width measurement can drift away from the actual scroll viewport, which
   changes the apparent zoom level and breaks the promise that the timeline
   reflects the configured viewport consistently across embeddings.
2. Narrow hosts can collapse the visible track to an unusable sliver beside the
   sticky label, which makes pan, scan, and visual interpretation fail even
   though the component is technically mounted.

There is a second independent contract issue:

3. Invalid minute inputs must fail synchronously at normalization boundaries.
   The library must not coerce strings, timestamps, or other non-numeric values
   into the layout model.

## Product Goal

Ship `SF.rail.createTimeline()` as a deterministic scheduling surface with:

- one canonical horizontal layout model
- one canonical numeric input contract
- one supported responsive behavior for narrow but valid hosts
- no fallback code paths masked as compatibility

## Non-Goals

This pass does not include:

- direct editing of schedule items
- a new top-level scheduling namespace
- a stacked mobile presentation
- legacy compatibility parsing for timestamp strings or `Date` objects
- parent-width heuristics
- guessed viewport widths
- preserving multiple layout algorithms for old callers

If product later wants a stacked or mobile-specific presentation, that must be a
separate PRD and a separate shipped contract.

## Public API Contract

The public API remains:

- `SF.rail.createTimeline(config)`
- returned API: `el`, `setModel(model)`, `setViewport(viewport)`,
  `expandCluster(laneId, clusterId | null)`, `destroy()`

The hardening pass changes contract quality, not API shape.

### Numeric input contract

The timeline accepts normalized numeric data only.

Every minute field must already be a finite number:

- `model.axis.startMinute`
- `model.axis.endMinute`
- `model.axis.initialViewport.startMinute`
- `model.axis.initialViewport.endMinute`
- `model.axis.days[].startMinute`
- `model.axis.days[].endMinute`
- `model.axis.ticks[]`
- `model.axis.ticks[].minute`
- `model.lanes[].items[].startMinute`
- `model.lanes[].items[].endMinute`
- `model.lanes[].overlays[].startMinute`
- `model.lanes[].overlays[].endMinute`
- `setViewport({ startMinute, endMinute })`

Integer-only fields remain integer-only:

- `model.lanes[].overlays[].dayIndex`
- `model.lanes[].overlays[].dayCount`

Rejected inputs include:

- ISO timestamps
- `Date` objects
- numeric strings
- `NaN`
- `Infinity`
- partially missing viewport objects

Validation must fail synchronously and point to the offending field. The
library must not call `Number(...)` on external inputs.

## Layout Contract

### Canonical width authority

The only measurement authority is the actual body scroller:

- `.sf-rail-timeline-body-viewport`

The following are not layout inputs:

- `root.parentNode`
- padded card wrappers
- outer container gutters
- inferred window width
- guessed viewport constants

Header and body must share one derived width model. The header mirrors the body
viewport; it does not own a second layout calculation.

### Supported width model

The component keeps the current side-label plus horizontal-track presentation.
It does not switch to a stacked layout in this hardening pass.

The layout engine must derive exactly these values from the measured body
viewport width and the current timeline state:

- `viewportWidth`
- `effectiveLabelWidth`
- `visibleTrackWidth`
- `contentTrackWidth`
- `contentWidth`

No other code path may derive competing width values.

### Responsive constraints

The layout contract is decision-complete and numeric:

- default preferred label width: `280px`
- minimum label width: `180px`
- minimum visible track width: `320px`
- minimum content track width before scale expansion: `480px`
- minimum supported body viewport width: `500px`

Derived behavior:

- for wide hosts, use the preferred label width
- for narrower hosts, compact the label width down to `180px`
- preserve at least `320px` of visible track for every supported host width
- use `480px` as the minimum base content-track width before zoom scaling

Below `500px` body viewport width, the layout is unsupported in this pass. Do
not add heuristics, alternate modes, or hidden fallbacks for sub-minimum hosts.

### Pre-measurement behavior

There is no guessed viewport fallback.

If the body viewport is not measurable yet:

- mount the static structure
- defer width-dependent rendering
- wait for a real measurement from `ResizeObserver`
- render once the body viewport has a non-zero width

Do not perform a speculative width render and then silently switch algorithms
after mount.

## Rendering Requirements

### Single layout path

All width-dependent rendering must flow through one derived layout object.

Required implementation shape:

- one `measureLayout(bodyViewport, state)` function
- one render pipeline that consumes the measured layout
- one scroll model derived from the actual body scroller

Forbidden implementation shape:

- a parent-width branch
- a root-width branch that outranks body viewport measurement
- a fixed-label path plus a responsive-label path
- a guessed-width initialization path
- scroll math that depends on synthetic fallback widths

### Styling path

Measured widths should be pushed through CSS custom properties on the timeline
root so header rows and lane rows consume the same values.

Required outputs include:

- `--sf-rail-label-width`
- `--sf-rail-content-width`

Grid columns must use the measured label width and a track column that behaves
correctly under shrink conditions. Use `minmax(0, 1fr)` where needed to avoid
implicit overflow math.

### Scroll behavior

The body scroller is the source of truth for horizontal position.

Requirements:

- body scroll drives viewport-to-minute conversion
- header scroll mirrors body scroll
- drag-to-pan works from both header and body
- scroll sync remains correct after mount, resize, zoom, and model replacement

## Existing Timeline Features That Must Remain Intact

This hardening pass must preserve:

- sticky top time header
- sticky left lane labels
- synchronized horizontal viewport for header and body
- hidden native horizontal scrollbar
- drag-to-pan from header and lane body
- zoom presets: `1w`, `2w`, `4w`, `Reset`
- weekend shading
- six-hour tick marks
- hover tooltips
- interval packing for detailed lanes
- cluster rendering and expansion for overview lanes
- lane overlays

## Documentation Requirements

In the same change:

- update `README.md` to describe the numeric-only input contract and supported
  responsive layout behavior
- keep `README.md` as the shipped source of truth for public runtime behavior
- update demos if any copy implies parent-based sizing, unspecified narrow
  behavior, or coercive input handling
- do not document unsupported sub-`500px` layout behavior as shipped capability

## Implementation Surface

Primary source files:

- `js-src/13a-rail-timeline.js`
- `css-src/19-rail-timeline.css`
- `README.md`
- `tests/rail-timeline.test.js`
- `tests/demo-browser-check.js`

Generated assets updated in the same work:

- `static/sf/sf.css`
- `static/sf/sf.js`
- `static/sf/sf.0.4.3.css`
- `static/sf/sf.0.4.3.js`

## Acceptance Criteria

### Layout invariants

1. The same timeline model rendered into hosts with different outer padding but
   the same body viewport width must show the same apparent zoom density.
2. The measured width used for layout must come from the body viewport, not the
   padded parent.
3. In every supported host width, the visible track must remain at least
   `320px`.
4. In every supported host width, the label column must never exceed the
   measured constraints produced by the canonical layout function.
5. Header and body must remain aligned after resize and drag-pan.

### Numeric invariants

6. Invalid numeric inputs must throw synchronously before rendering.
7. No external minute field may be coerced with `Number(...)`.
8. Overlay `dayIndex` and `dayCount` must reject non-integer values.

### Product invariants

9. No alternate stacked or fallback presentation mode is introduced.
10. No compatibility branch survives for parent-based width measurement or
    guessed viewport sizing.

## Test Plan

### Unit coverage

Add or update tests to prove:

- padded parent width does not affect rendered time density
- the body viewport is the measured width authority
- a `500px` supported host preserves at least `320px` visible track
- label compaction happens before track collapse
- resize after mount recomputes layout from the same canonical path
- invalid axis, day, tick, item, overlay, and runtime viewport inputs throw
  descriptive errors

### Browser coverage

Extend demo browser checks to prove:

- real horizontal overflow exists in the shipped timeline demo
- header and body scroll positions stay synchronized
- drag-to-pan remains functional
- padded demo cards do not distort zoom density

### Regression coverage

Also verify:

- low-level `SF.rail` primitives still work
- `SF.gantt` remains unaffected
- generated bundled assets reflect the hardened behavior

## Delivery Plan

Ship in two conventional commits:

1. `fix(rail): make timeline layout viewport-driven`
2. `fix(rail): reject non-numeric timeline minute inputs`

Each commit must include:

- source changes
- tests
- documentation changes for its contract
- regenerated assets when applicable

## Final Requirement

This work is complete only when `SF.rail.createTimeline()` behaves as one
deterministic product surface:

- one measurement authority
- one layout derivation path
- one scroll model
- one numeric validation path

Anything that preserves duplicate paths for compatibility or fallback fails this
PRD.
