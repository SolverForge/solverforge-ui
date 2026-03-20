# SolverForge UI — Component Wireframes

Visual reference for every component in the library. Each section shows the
DOM structure, CSS classes, and how the JS factory wires them together.

---

## 1. Full Page Layout

```
+------------------------------------------------------------------------+
| .sf-header  (sticky, 60px, emerald gradient)                           |
|  [logo] [title / subtitle]         [nav tabs...]    [Solve][Stop][Ana] |
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
|  │🐍│  Furnace Scheduler     [Forni] [Ordini] [Gantt]   [▶ Solve] [◉] |
|  └──┘  by SolverForge        ←─ nav tabs ──→            ←─ actions ──→ |
+------------------------------------------------------------------------+
   ↑                     ↑                                    ↑
   .sf-header-logo       .sf-header-brand                     .sf-header-actions
   44×44, white filter   .sf-header-title (18px, white)       .sf-btn--success (Solve)
                         .sf-header-subtitle (12px, mono)     .sf-btn--danger  (Stop, hidden)
                                                              .sf-btn--ghost   (Analyze, circle)
```

**JS:** `SF.createHeader({ logo, title, subtitle, tabs[], onTabChange, actions: { onSolve, onStop, onAnalyze } })`

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
Returns: `{ el, bindHeader(header), updateScore(str), setSolving(bool), updateMoves(n), colorDotsFromAnalysis(arr) }`

Pass `header` or call `bindHeader(header)` when the status bar should control a
specific header's Solve/Stop/spinner state. Without a bound header,
`setSolving()` only updates the status text and moves display.

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
|  SolverForge  │  Documentation  │  GitHub        v0.1.0                |
|  ↑ links with hover emerald                      ↑ right-aligned      |
+------------------------------------------------------------------------+
```

**JS:** `SF.createFooter({ links: [{label, url}], version })`

---

## 12. API Guide Panel

```
  ┌─────────────────────────────────────────────┐
  │  GET /schedules/{id}                        │  .sf-api-section h3
  │  Get the current best solution.             │  (emerald-700 text)
  │  ┌───────────────────────────────────┬────┐ │
  │  │ curl localhost:7860/schedules/abc │Copy│ │  .sf-api-code-block
  │  └───────────────────────────────────┴────┘ │  .sf-copy-btn
  └─────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────┐
  │  DELETE /schedules/{id}                     │
  │  Stop solving and save checkpoint.          │
  │  ┌───────────────────────────────────┬────┐ │
  │  │ curl -X DELETE localhost:786...   │Copy│ │
  │  └───────────────────────────────────┴────┘ │
  └─────────────────────────────────────────────┘
```

**JS:** `SF.createApiGuide({ endpoints: [{ method, path, description, curl }] })`

---

## 13. Timeline Rail (the hero scheduling view)

```
  .sf-timeline-header
  ┌────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
  │  RESOURCE  │   Mon    │   Tue    │   Wed    │   Thu    │   Fri    │
  └────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

  .sf-resource-card                                        ← one per resource
  ┌────────────┬──────────────────────────────────────────────────────┐
  │ FORNO 1    │  ░░░░ gauge bars ░░░░░                              │
  │ ┌────────┐ │  Temp ████████░░░  850/1000°C                      │
  │ │CAMERA  │ │  Load ██████░░░░░  120/200 kg                      │
  ├────────────┼──────────────────────────────────────────────────────┤
  │ Jobs   12  │  ┌──────┐   ┌────────────┐  ┌────┐   ┌──────────┐  │
  │ Prod 840kg │  │ODL-14│   │  ODL-2847  │  │late│   │ ODL-991  │  │
  │ Procs T,R  │  │Rossi │   │  Bianchi   │  │glow│   │ Verdi    │  │
  │            │  └──────┘   └────────────┘  └────┘   └──────────┘  │
  │ .sf-       │  ↑ .sf-block (positioned by start/end %)           │
  │ resource-  │     color per process, late blocks glow red        │
  │ stats      │                                                     │
  │            │  ╲╲╲╲  .sf-changeover  (diagonal amber stripes)     │
  └────────────┴──────────────────────────────────────────────────────┘
     200px fixed    ← remaining width is the rail →
```

**JS:**
```
var header = SF.rail.createHeader({
  label: 'Forno', labelWidth: 200,
  columns: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'],
});

var card = SF.rail.createCard({
  id: 'furnace-1', name: 'FORNO 1', labelWidth: 200,
  type: 'CAMERA', typeStyle: { bg: 'rgba(59,130,246,0.15)', color: '#1d4ed8' },
  badges: ['TEMPRA', { label: 'HOT', style: { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' } }],
  columns: 5,
  gauges: [
    { label: 'Temp', pct: 85, style: 'heat', text: '850/1000°C' },
    { label: 'Load', pct: 60, style: 'load', text: '120/200 kg' },
  ],
  stats: [
    { label: 'Jobs', value: 12 },
    { label: 'Prod', value: '840 kg' },
  ],
});

card.addBlock({
  start: 120, end: 360, horizon: 4800,
  label: 'ODL-2847', meta: 'Bianchi',
  color: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6',
  late: false,
  onHover: function (e, cfg) { showTooltip(e, cfg); },
});

card.setSolving(true);   // breathing emerald glow
card.clearBlocks();
```

---

## 14. Gantt Chart (Frappe Gantt)

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

---

## 16. Map Module (optional, requires Leaflet)

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
map.drawRoute({ points, color });
map.drawEncodedRoute({ encoded, color });
map.highlight(vehicleColor);
```

---

## 17. Constraint Analysis (in Modal)

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
