# Demo Fixtures

These fixtures are intended to validate the shipped `solverforge-ui` surface locally.

## Start a local server

From the repository root:

```bash
make demo-serve
```

Then open:

- `http://localhost:8000/demos/`
- `http://localhost:8000/demos/full-surface.html`
- `http://localhost:8000/demos/timeline.html`
- `http://localhost:8000/demos/rail.html`

## Automated browser verification

Install the browser-test dependency and Chromium once:

```bash
make browser-setup
```

Then run the smoke checks:

```bash
make test-browser
```

The automated check serves the repository locally, opens the runnable demo fixtures in Chromium, fails on page or script errors, and verifies that the primary shipped UI surfaces mount successfully.

## Coverage

- `full-surface.html`: header, status bar, tabs, buttons, modal, toast, table, canonical scheduling timeline, Gantt, API guide, and footer
- `timeline.html`: focused dense scheduling example using `SF.rail.createTimeline()` with overview and detailed lanes
- `rail.html`: advanced low-level resource header, cards, gauges, blocks, and changeovers
