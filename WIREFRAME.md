# SolverForge UI — Component Wireframes

Visual reference for every component in the library. Each section shows the
DOM structure, CSS classes, and how the JS factory wires them together.

Sections in this document follow a simple staging rule:

- Shipped: backed by the current JavaScript API in `js-src/` and safe to document as supported behavior.
- Planned: useful design or styling direction, but not part of the supported public API yet.

---

## 1. Full Page Layout

```
+------------------------------------------------------------------------+
| .sf-header  (sticky, 60px, emerald gradient)                           |
|  [logo] [title / subtitle]         [nav tabs...] [Solve][Pause][Ana]   |
+------------------------------------------------------------------------+
| .sf-statusbar  (score | constraint dots | moves/s | status)            |
+------------------------------------------------------------------------+
|                                                                        |
|  .sf-main                                                              |
|                                                                        |
|    .sf-tab-panel.active                                                |
|    +------------------------------------------------------------------+|
|    |                                                                  ||
|    |  (application content)                                           ||
|    |                                                                  ||
|    +------------------------------------------------------------------+|
|                                                                        |
+------------------------------------------------------------------------+
| .sf-footer  (links | version)                                          |
+------------------------------------------------------------------------+
```

Wrap the page in `<body class="sf-app">` to get the flex column layout,
sticky header, and scrollable main area.

---

## 2. Header

```
+------------------------------------------------------------------------+
|  ┌──┐                                                                  |
|  │🐍│  Furnace Scheduler [Forni] [Ordini] [Gantt] [▶ Solve][❚❚][◉]    |
|  └──┘  by SolverForge        ←─ nav tabs ──→            ←─ actions ──→ |
+------------------------------------------------------------------------+
   ↑                     ↑                                    ↑
   .sf-header-logo       .sf-header-brand                     .sf-header-actions
   44×44, white filter   .sf-header-title (18px, white)       .sf-btn--success (Solve)
                         .sf-header-subtitle (12px, mono)     .sf-btn--default (Pause, hidden)
                                                              .sf-btn--danger  (Stop, lifecycle visible)
                                                              .sf-btn--ghost   (Analyze, circle)
```

**JS:** `SF.createHeader({ logo, title, subtitle, tabs[], onTabChange, actions: { onSolve, onPause, onResume, onCancel, onAnalyze } })`

**Nav buttons** (`.sf-nav-btn`): semi-transparent white, `.active` state toggles on click.

---

## 3. Status Bar

```
+------------------------------------------------------------------------+
|  0hard/-42soft  |  ●●●●○○●●●  |  12,400 moves/s  |  Solving...       |
|  ↑                 ↑              ↑                    ↑               |
|  .sf-statusbar-    .sf-constraint- moves display       status text     |
|  score             dot                                                 |
|  (green/yellow/                                                        |
|   red by score)    green = OK                                          |
|                    red   = hard violated (pulses)                      |
|                    amber = soft violated (pulses)                      |
+------------------------------------------------------------------------+
```

**JS:** `SF.createStatusBar({ header?, constraints[], onConstraintClick })`
Returns: `{ el, bindHeader(header), updateScore(str), setLifecycleState(state), setSolving(bool), updateMoves(n), updateConstraintDots(arr), colorDotsByScore(str), colorDotsFromAnalysis(arr) }`

Pass `header` or call `bindHeader(header)` when the status bar should control a
specific header's lifecycle controls and spinner state. Without a bound header,
`setLifecycleState()` only updates the status text and moves display.

---

## 4. Buttons

```
  Variants:
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ ▶ Solve  │  │ ■ Stop   │  │  Primary │  │  Default │  │  Ghost   │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
  --success      --danger      --primary     --default     --ghost
  white bg       red-600 bg    emerald-700   gray border   transparent
  emerald text   white text    white text    gray text     white text

  Sizes:                         Shapes:
  ┌────┐ ┌────────┐ ┌──────────┐    ┌────────────────┐  ┌──┐
  │ sm │ │ medium │ │  large   │    │  pill (rounded) │  │◉ │ circle
  └────┘ └────────┘ └──────────┘    └────────────────┘  └──┘

  Modifiers:
  ┌ ─ ─ ─ ─ ─ ─┐   --outline: border only, transparent bg
  │  Outlined   │   combinable with any variant
  └ ─ ─ ─ ─ ─ ─┘
```

**JS:** `SF.createButton({ text, variant, size, icon, pill, circle, outline, disabled, onClick })`

---

## 5. Modal Dialog

```
  ┌────────────────────────────────────────────┐
  │  ░░░░░░░░░░ emerald gradient ░░░░░░░░░░  ×│  .sf-modal-header
  │  Score Analysis                            │  .sf-modal-title
  ├────────────────────────────────────────────┤
  │                                            │
  │  .sf-modal-body  (scrollable)              │
  │                                            │
  │  ┌──────────────────────────────────────┐  │
  │  │  constraint table / analysis / form  │  │
  │  └──────────────────────────────────────┘  │
  │                                            │
  ├────────────────────────────────────────────┤
  │                              [Close]       │  .sf-modal-footer
  └────────────────────────────────────────────┘

  Backdrop: .sf-modal-overlay (dark, blur)
  Animation: scale(0.95) → scale(1), 180ms
```

**JS:** `SF.createModal({ title, body, footer[], width?, onClose? })`
Returns: `{ el, body, open(), close(), setBody(content) }`

---

## 6. Data Table

```
  ┌────────────────────────────────────────────────────────┐
  │  NAME        │ PROCESS    │ PRIORITY │ DUE      │ SCORE│  .sf-table th
  ├──────────────┼────────────┼──────────┼──────────┼──────┤
  │  Order #142  │ ┌────────┐ │ ┌──────┐ │ Mon 14:00│ -200 │
  │              │ │Tempra  │ │ │ HIGH │ │          │      │
  │              │ └────────┘ │ └──────┘ │          │      │
  ├──────────────┼────────────┼──────────┼──────────┼──────┤
  │  Order #143  │ ┌────────┐ │ ┌──────┐ │ Tue 09:00│    0 │
  │              │ │Ricott. │ │ │ LOW  │ │          │      │  hover: gray-50
  │              │ └────────┘ │ └──────┘ │          │      │
  └──────────────┴────────────┴──────────┴──────────┴──────┘
                   .sf-badge     .sf-badge
                   --process     --high / --medium / --low
```

**JS:** `SF.createTable({ columns[], rows[], onRowClick? })`

---

## 7. Badges

```
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │  Tempra    │  │   HIGH     │  │  HARD      │
  │  (process) │  │  (priority)│  │ (constraint)│
  └────────────┘  └────────────┘  └────────────┘
  colored bg/      red bg/text     red border
  border per       amber bg/text   amber border
  process type     green bg/text

  ┌─────────────┐
  │  Forklift   │   .sf-badge--skill
  │  (skill)    │   emerald-50 bg, emerald-700 text
  └─────────────┘
```

---

## 8. KPI Cards

```
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │    154    │  │     3     │  │    96%   │  │   1,240  │
  │  ORDERS  │  │   LATE   │  │ ON-TIME  │  │  WEIGHT  │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
   .sf-kpi-card  .sf-kpi-value.danger
   gray-50 bg    red for danger
                 amber for warn
                 emerald for ok
```

Wrapped in `.sf-kpi-row` (flex, gap).

---

## 9. Toast Notifications

```
                                          ┌──────────────────────────┐
                                          │  ┃  Error              × │
                                          │  ┃  Connection refused   │
                                          │  ┃  404: Not Found       │
                                          └──────────────────────────┘
                                            ↑
                                            .sf-toast--danger
                                            red left border
                                            top-right fixed position
                                            auto-dismiss 10s

  Variants: --danger (red), --success (emerald), --warning (amber)
```

**JS:** `SF.showToast({ title, message, detail?, variant, delay? })`
Shorthand: `SF.showError(title, detail)`

---

## 10. Tooltip

```
             ┌─────────────────────┐
             │  ODL-2847           │  .sf-tooltip-title
             │  Process   Tempra  │  .sf-tooltip-row
             │  Temp      850°C   │    .sf-tooltip-key / .sf-tooltip-val
             │  Weight    120 kg  │
             │  Due       Mon 14h │
             │  ┌───────────────┐ │
             │  │ LATE: +45 min │ │  late badge
             │  └───────────────┘ │
             └─────────────────────┘
             fixed position, shadow-xl
             opacity transition 150ms
```

---

## 11. Footer

```
+------------------------------------------------------------------------+
|  SolverForge  │  Documentation  │  GitHub        v0.6.2                |
|  ↑ links with hover emerald                      ↑ right-aligned      |
+------------------------------------------------------------------------+
```

**JS:** `SF.createFooter({ links: [{label, url}], version })`

---

## 12. API Guide Panel

```
  ┌─────────────────────────────────────────────┐
  │  GET /jobs/{id}/snapshot                    │  .sf-api-section h3
  │  Get the latest or requested retained       │  (emerald-700 text)
  │  snapshot for a job.                        │
  │  ┌───────────────────────────────────┬────┐ │
  │  │ curl localhost:7860/jobs/abc/      │Copy│ │  .sf-api-code-block
  │  │ snapshot?snapshot_revision=4       │    │ │
  │  └───────────────────────────────────┴────┘ │  .sf-copy-btn
  └─────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────┐
  │  POST /jobs/{id}/pause                      │
  │  Request an exact runtime-managed pause.    │
  │  ┌───────────────────────────────────┬────┐ │
  │  │ curl -X POST localhost:7860/jobs/ │Copy│ │
  │  │ abc/pause                         │    │ │
  │  └───────────────────────────────────┴────┘ │
  └─────────────────────────────────────────────┘
```

**JS:** `SF.createApiGuide({ endpoints: [{ method, path, description, curl }] })`

---

## 13. Solver Stream Contract (Shipped)

```
  start()
    │
    ├── "progress"       → scored metadata update only
    │
    └── "best_solution"  → scored live snapshot update

  Startup rule:
  the first lifecycle event may be either branch above, but it must already
  carry score data.

  Retained bootstrap rule:
  if startup state is restored from a retained snapshot, do not follow that
  bootstrap with an identical duplicate startup "best_solution".
```

Shipped runtime expectations:

- `progress` updates score, telemetry, and status only.
- `best_solution` updates score, telemetry, and the live solution view.
- `best_solution` always includes `solution` plus `snapshotRevision`.
- `paused`, `completed`, `cancelled`, and `failed` remain authoritative and
  trigger retained snapshot synchronization before downstream callbacks fire.
- HTTP `EventSource.onerror` is transport state. Reconnecting errors stay local
  to the browser transport; a closed stream surfaces through `onError` and
  preserves the last authoritative lifecycle, retained job id, score, metadata,
  and snapshot revision.
- `start()` never replaces a retained job. Terminal retained jobs require
  successful `delete()` cleanup before another solve can start.
- `delete()` waits for terminal synchronization, calls backend `deleteJob()`,
  and clears local retained state only after required terminal synchronization
  and backend cleanup both succeed. `COMPLETED` and `TERMINATED_BY_CONFIG`
  require successful terminal snapshot sync before backend deletion.
- Stop remains visible during `CANCELLING`, but that state blocks duplicate
  cancel commands. Activating Stop during `CANCELLING` may reattach a detached
  stream listen-only so the UI can observe the terminal event.

---

## 14. Rail Scheduling Timeline (Shipped Core)

```
  .sf-rail-timeline
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [1W] [2W] [4W] [Reset]                         drag to pan · read only     │
  ├───────────────┬─────────────────────────────────────────────────────────────┤
  │ Staffing lane │  Mon 20      Tue 21      Wed 22      Thu 23      Fri 24    │  sticky top time header
  │               │  00 06 12 18 00 06 12 18 00 06 12 18 00 06 12 18 ...       │  6-hour tick marks
  ├───────────────┼─────────────────────────────────────────────────────────────┤
  │ Ward East     │  ███ summary ███            █ cardio block █                │  overview lane
  │ Coverage 92%  │  count/open chips + tone mix bar keep dense windows legible │
  ├───────────────┼─────────────────────────────────────────────────────────────┤
  │ Ward West     │      ███ summary ███                     █ handoff █        │  overview lane
  │ Coverage 88%  │  overlays stay behind the schedule; focus reveals tooltip   │
  ├───────────────┼─────────────────────────────────────────────────────────────┤
  │ Ada           │  █ primary █                                                │
  │ Hours 38h     │      █ overlap █                                            │  detailed lane
  │               │  track 0                     track 1                         │  interval packed
  ├───────────────┼─────────────────────────────────────────────────────────────┤
  │ Marco         │           █ primary █                                        │  detailed lane
  │ Hours 42h     │              █ late coverage █                               │
  └───────────────┴─────────────────────────────────────────────────────────────┘

  sticky left lane labels
  hidden native scrollbar
  weekend shading behind the axis
```

**JS:**
```
var timeline = SF.rail.createTimeline({
  label: 'Staffing lane',
  labelWidth: 280,
  model: {
    axis: {
      startMinute: 0,
      endMinute: 28 * 1440,
      days: buildDays(28),
      ticks: buildSixHourTicks(28),
      initialViewport: { startMinute: 0, endMinute: 14 * 1440 },
    },
    lanes: [
      {
        id: 'ward-east',
        label: 'By location · Ward East',
        mode: 'overview',
        overlays: [{ dayIndex: 5, label: 'Unavailable', tone: 'red' }],
        items: [
          {
            id: 'east-rush',
            clusterId: 'east-rush',
            startMinute: 360,
            endMinute: 1080,
            label: 'Monday intake surge',
            tone: 'blue',
            summary: {
              primaryLabel: 'Monday intake surge',
              secondaryLabel: 'ER intake · trauma hold · overflow beds',
              count: 24,
              openCount: 3,
              toneSegments: [
                { tone: 'blue', count: 15 },
                { tone: 'amber', count: 6 },
                { tone: 'rose', count: 3 },
              ],
            },
            detailItems: [
              { id: 'east-1', startMinute: 360, endMinute: 840, label: 'ER intake', tone: 'blue' },
              { id: 'east-2', startMinute: 420, endMinute: 960, label: 'Trauma hold', tone: 'amber' },
              { id: 'east-3', startMinute: 480, endMinute: 1080, label: 'Overflow beds', tone: 'rose' },
            ],
          },
        ],
      },
      {
        id: 'employee-ada',
        label: 'By employee · Ada',
        mode: 'detailed',
        items: [
          { id: 'ada-1', startMinute: 2 * 1440 + 360, endMinute: 2 * 1440 + 840, label: 'Primary shift', tone: 'amber' },
          { id: 'ada-2', startMinute: 2 * 1440 + 660, endMinute: 2 * 1440 + 1020, label: 'Handoff overlap', tone: 'amber' },
        ],
      },
    ],
  },
});

timeline.setViewport({ startMinute: 7 * 1440, endMinute: 21 * 1440 });
timeline.expandCluster('ward-east', 'east-rush');
```

The original `createHeader/createCard/addBlock/addChangeover` APIs remain
shipped as low-level primitives, but they are no longer the recommended
integration path for dense scheduling UIs.

Shipped dense overview rules:

- overview lanes are for scanability, not raw-label dumps
- additive `summary` metadata can provide explicit headline, count, open state, and tone mix
- mixed summarized/raw groups combine explicit summary fields with derived count/open/tone data from the other grouped items
- summary items that override aggregate count must also provide open/tone aggregate data if those signals should be shown
- if `summary` is omitted, the timeline computes a default aggregate summary from grouped detail items
- expanded overview clusters keep the aggregate block visible as the collapse affordance
- focus and hover expose the same tooltip content for overview and detailed blocks

---

## 15. Gantt Chart (Frappe Gantt)

```
  .sf-gantt-split
  ┌──────────────────────────────────────────────────────────────────┐
  │  .sf-gantt-pane  (grid)                                         │
  │  ┌────────────────────────────────────────────────────────────┐  │
  │  │  Tasks                                                    │  │  .sf-gantt-pane-header
  │  ├────────────────────────────────────────────────────────────┤  │
  │  │  TASK              │ START      │ P                    │   │  │  .sf-gantt-table th
  │  ├───────────────────────────────────────────────────────────│  │
  │  │▌ Design review     │ 09:00      │ P1                   │   │  │  .sf-gantt-row
  │  │▌ Implementation    │ 10:30      │ P2                   │   │  │  left border = custom_class
  │  │▌ Testing           │ 14:00      │ P3                   │   │  │  sweep underline on hover
  │  └────────────────────────────────────────────────────────────┘  │
  ├══════════════════════════════════════════════════════════════════┤  ← Split.js gutter (4px, emerald on hover)
  │  .sf-gantt-pane  (chart)                                        │
  │  ┌────────────────────────────────────────────────────────────┐  │
  │  │  Schedule                 [Quarter Day ▾]                 │  │  .sf-gantt-pane-header
  │  ├────────────────────────────────────────────────────────────┤  │
  │  │  Frappe Gantt SVG                                         │  │
  │  │  ┌───────────────┬──────────────────────────┬─────────┐   │  │
  │  │  │  09:00  10:00 │  11:00  12:00  13:00     │ 14:00   │   │  │
  │  │  ├───────────────┼──────────────────────────┼─────────┤   │  │
  │  │  │  ████████████ ┼──→ ██████████████████████│         │   │  │  bars colored by custom_class
  │  │  │  Design       │    Implementation        │         │   │  │  arrows = dependencies
  │  │  │               │                          │ ████████│   │  │
  │  │  │               │                          │ Testing │   │  │
  │  │  └───────────────┴──────────────────────────┴─────────┘   │  │
  │  │                                                           │  │
  │  │  hover: brightness(1.12) + drop-shadow                   │  │
  │  │  drag: grab cursor                                         │  │
  │  │  resize: ew-resize handles appear on hover                │  │
  │  └────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────┘
```

**JS:**
```
var gantt = SF.gantt.create({
  gridTitle: 'Tasks', chartTitle: 'Schedule',
  viewMode: 'Quarter Day',
  columns: [
    { key: 'name', label: 'Task' },
    { key: 'start', label: 'Start' },
    { key: 'priority', label: 'P', render: fn },
  ],
  onTaskClick: function (task) { ... },
  onDateChange: function (task, start, end) { ... },
});
gantt.mount('container');
gantt.setTasks(taskArray);
gantt.changeViewMode('Day');
gantt.highlightTask('task-1');
```

Requires: `/sf/vendor/frappe-gantt/` + `/sf/vendor/split/`

## 16. Low-Level Rail Add-ons (Shipped)

These helpers remain shipped for custom primitive rail compositions:

- `.sf-heatmap` / `.sf-heatmap-segment` via `SF.rail.createHeatmap(config)`
- `.sf-unassigned-pill` via `SF.rail.createUnassignedRail(tasks, onTaskClick)` or `card.setUnassigned(items)`

Treat them as low-level add-ons, not the canonical dense scheduling entrypoint.

---

## 17. Map Module (optional, requires Leaflet)

```
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │         🏠 depot (sf-marker-vehicle)            │
  │          ╲                                      │
  │           ╲── route polyline (color per vehicle)│
  │            ╲                                    │
  │    ①───②───③  (sf-marker-stop, numbered)       │
  │             │                                   │
  │    🍴 visit (sf-marker-visit, icon per type)    │
  │                                                 │
  │  ┌──────────────────────────────────────────┐   │
  │  │  Click to add new visit                  │   │  .sf-map-hint
  │  └──────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────┘
```

**JS:**
```
var map = SF.map.create({ container, center, zoom });
map.addVehicleMarker({ lat, lng, color });
map.addVisitMarker({ lat, lng, color, icon, assigned });
map.addStopNumber({ lat, lng, number, color });
map.drawRoute({ points, color });
map.drawEncodedRoute({ encoded, color });
map.highlight(vehicleColor);
map.clearRoutes();
map.clearStops();
map.clearMarkers();
map.clearAll();
```

---

## 18. Constraint Analysis (in Modal)

```
  ┌──────────────────────────────────────────────────┐
  │  ░░░ Score Analysis ░░░░░░░░░░░░░░░░░░░░░░░░  ×│
  ├──────────────────────────────────────────────────┤
  │                                                  │
  │  ●  Constraint         Type   #     Score        │  .sf-ov-table
  │  ─────────────────────────────────────────       │
  │  🔴 Unassigned         HARD   3    -600          │  .sf-ov-row-violated
  │  🔴 Temp Exceeded      HARD   1    -150          │
  │  🟢 Process Compat     HARD   0       0          │
  │  🟡 Late Delivery      SOFT  12   -840          │
  │  🟡 Changeover Cost    SOFT   8   -240          │
  │  🟢 Shift Balance      SOFT   0       0          │
  │                                                  │
  │  Click a row to see individual violations →      │
  │                                                  │
  ├──────────────────────────────────────────────────┤
  │                                       [Close]    │
  └──────────────────────────────────────────────────┘
```

---

## Color Reference

```
  Emerald (Primary)                    Semantic
  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐       ┌──────────────────┐
  │50││100│200│300│400│500│600│       │ success = 500    │
  └──┘└──┘└──┘└──┘└──┘└──┘└──┘       │ primary = 700    │
  light ──────────────────→ dark       │ danger  = red-600│
                                       │ warning = amb-500│
  Project Colors (8)                   └──────────────────┘
  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐
  │Em││Bl││Pu││Am││Pk││Cy││Ro││Li│
  └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘
  #10b981 #3b82f6 #8b5cf6 #f59e0b ...

  Fonts
  ────────────────────────────────
  Body: Space Grotesk (400–700)
  Mono: JetBrains Mono (400–700)
```
