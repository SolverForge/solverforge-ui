/* ============================================================================
   SolverForge UI — Status Bar Factory
   ============================================================================ */

import { bindActivation, el } from "../core";
import { colorClass, parseHard, parseSoft } from "../utils/score";
import { HeaderControls } from "./header";

export interface StatusBarConstraint {
  name?: string;
  type?: 'hard' | 'soft';
  score?: string;
}

export interface StatusBarConfig {
  constraints?: StatusBarConstraint[];

  onConstraintClick?: (index: number) => void;

  header?: {
    sfControls?: HeaderControls;
  };
}

export interface StatusBarApi {
  el: HTMLDivElement;

  bindHeader(header: {
    sfControls?: HeaderControls;
  } | null): StatusBarApi;

  updateScore(scoreStr: string | null): void;

  setLifecycleState(state: string): void;

  setSolving(solving: boolean): void;

  updateMoves(mps: number | null): void;

  updateConstraintDots(
    constraints: StatusBarConstraint[]
  ): void;

  colorDotsByScore(scoreStr: string): void;

  colorDotsFromAnalysis(
    constraints: StatusBarConstraint[]
  ): void;
}

export const createStatusBar = function (
  config: StatusBarConfig = {}
): StatusBarApi {
    var bar = el('div', { className: 'sf-statusbar' }) as HTMLDivElement;
    var lastScore: string | null = null;
    var controls: HeaderControls | null = null;

    // Score display
    var scoreEl = el('span', { className: 'sf-statusbar-score', id: 'sfScoreDisplay', 'aria-live': 'polite' }, '\u2014');
    bar.appendChild(scoreEl);

    // Separator
    bar.appendChild(el('span', { className: 'sf-statusbar-sep' }, '|'));

    // Constraint dots container
    var dotsContainer = el('div', { className: 'sf-statusbar-constraints' }) as HTMLDivElement;
    bar.appendChild(dotsContainer);

    // Separator + moves display
    var movesSep = el('span', { className: 'sf-statusbar-sep' }, '|');
    movesSep.style.display = 'none';
    bar.appendChild(movesSep);

    var movesEl = el('span');
    movesEl.style.display = 'none';
    bar.appendChild(movesEl);

    // Separator + status text
    bar.appendChild(el('span', { className: 'sf-statusbar-sep' }, '|'));
    var statusEl = el('span', { id: 'sfStatusText', role: 'status', 'aria-live': 'polite' });
    bar.appendChild(statusEl);

    // Build initial constraint dots
    if (config && config.constraints) {
      buildDots(dotsContainer, config.constraints, config.onConstraintClick);
    }

    var api: StatusBarApi = {
      el: bar,
      bindHeader: function (header) {
        controls = header && header.sfControls ? header.sfControls : null;
        return api;
      },

      updateScore: function (scoreStr) {
        if (scoreStr && scoreStr !== lastScore) {
          scoreEl.textContent = scoreStr;
          var colorClassName = colorClass(scoreStr);
          scoreEl.classList.remove('improved', 'score-green', 'score-red', 'score-yellow');
          scoreEl.classList.add(colorClassName);
          void scoreEl.offsetWidth;
          scoreEl.classList.add('improved');
          lastScore = scoreStr;
        } else if (!scoreStr) {
          scoreEl.textContent = '\u2014';
          scoreEl.classList.remove('score-green', 'score-red', 'score-yellow', 'improved');
          lastScore = null;
        }
      },

      setLifecycleState: function (state) {
        var normalized = normalizeLifecycleState(state);
        var solveBtn = controls && controls.solveBtn;
        var pauseBtn = controls && controls.pauseBtn;
        var resumeBtn = controls && controls.resumeBtn;
        var cancelBtn = controls && controls.cancelBtn;
        var spinner = controls && controls.spinner;

        if (solveBtn) solveBtn.style.display = shouldShowSolve(normalized) ? '' : 'none';
        if (pauseBtn) {
          pauseBtn.style.display = shouldShowPause(normalized) ? '' : 'none';
          pauseBtn.disabled = normalized === 'PAUSE_REQUESTED';
        }
        if (resumeBtn) {
          resumeBtn.style.display = normalized === 'PAUSED' ? '' : 'none';
          resumeBtn.disabled = false;
        }
        if (cancelBtn) {
          cancelBtn.style.display = shouldShowCancel(normalized) ? '' : 'none';
          cancelBtn.disabled = false;
        }
        if (spinner) spinner.classList.toggle('active', shouldSpin(normalized));

        statusEl.textContent = lifecycleLabel(normalized);
        statusEl.style.color = isActiveLifecycle(normalized)
          ? 'var(--sf-emerald-600)'
          : normalized === 'FAILED'
            ? 'var(--sf-red-600)'
            : normalized === 'CANCELLED'
              ? 'var(--sf-amber-700)'
              : 'var(--sf-gray-500)';
      },

      setSolving: function (solving) {
        api.setLifecycleState(solving ? 'SOLVING' : 'IDLE');
      },

      updateMoves: function (mps) {
        if (mps != null && mps > 0) {
          movesEl.textContent = mps.toLocaleString() + ' moves/s';
          movesEl.style.display = '';
          movesSep.style.display = '';
        } else {
          movesEl.style.display = 'none';
          movesSep.style.display = 'none';
        }
      },

      updateConstraintDots: function (constraints) {
        buildDots(dotsContainer, constraints, config && config.onConstraintClick);
      },

      colorDotsByScore: function (scoreStr) {
        var hard = parseHard(scoreStr);
        var soft = parseSoft(scoreStr);
        dotsContainer.querySelectorAll('.sf-constraint-dot').forEach(function (dot: HTMLDivElement) {
          var isHard = dot.dataset.type === 'hard';
          dot.classList.toggle('violated', isHard && hard < 0);
          dot.classList.toggle('violated-soft', !isHard && soft < 0);
        });
      },

      colorDotsFromAnalysis: function (constraints) {
        if (!constraints || constraints.length === 0) return;
        buildDots(dotsContainer, constraints, config && config.onConstraintClick);
        dotsContainer.querySelectorAll('.sf-constraint-dot').forEach(function (dot, i) {
          var c = constraints[i];
          if (!dot) return;
          var isHardConstraint = c.type === 'hard';
          var scoreVal = isHardConstraint ? parseHard(c.score) : parseSoft(c.score);
          var violated = scoreVal < 0;
          dot.classList.toggle('violated', isHardConstraint && violated);
          dot.classList.toggle('violated-soft', !isHardConstraint && violated);
        });
      },
    }

    if (config && config.header) {
      api.bindHeader(config.header);
    }

    api.setLifecycleState('IDLE');

    return api;
  };

  function buildDots(container, constraints, onClick) {
    container.innerHTML = '';
    if (!constraints) return;
    constraints.forEach(function (c, i) {
      var dot = el('div', {
        className: 'sf-constraint-dot',
        id: 'sf-cdot-' + i,
        title: c.name || ('Constraint ' + i),
        role: onClick ? 'button' : null,
        tabIndex: onClick ? '0' : null,
        'aria-label': onClick ? ('Open constraint ' + (c.name || ('Constraint ' + i))) : null,
        dataset: { type: c.type || 'hard', index: String(i) },
      });
      if (onClick) {
        dot.style.cursor = 'pointer';
        bindActivation(dot, function () { onClick(i); });
      }
      container.appendChild(dot);
    });
  }

  function normalizeLifecycleState(value) {
    if (typeof value !== 'string' || !value.trim()) return 'IDLE';
    return value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
  }

  function shouldShowSolve(state) {
    return state === 'IDLE'
      || state === 'COMPLETED'
      || state === 'CANCELLED'
      || state === 'FAILED'
      || state === 'TERMINATED_BY_CONFIG';
  }

  function shouldShowPause(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED';
  }

  function shouldShowCancel(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'PAUSED'
      || state === 'RESUMING'
      || state === 'CANCELLING';
  }

  function shouldSpin(state) {
    return state === 'STARTING'
      || state === 'SOLVING'
      || state === 'PAUSE_REQUESTED'
      || state === 'RESUMING'
      || state === 'CANCELLING';
  }

  function isActiveLifecycle(state) {
    return shouldSpin(state);
  }

  function lifecycleLabel(state) {
    if (state === 'STARTING') return 'Starting...';
    if (state === 'SOLVING') return 'Solving...';
    if (state === 'PAUSE_REQUESTED') return 'Pause requested...';
    if (state === 'PAUSED') return 'Paused';
    if (state === 'RESUMING') return 'Resuming...';
    if (state === 'CANCELLING') return 'Cancelling...';
    if (state === 'COMPLETED') return 'Completed';
    if (state === 'CANCELLED') return 'Cancelled';
    if (state === 'FAILED') return 'Failed';
    if (state === 'TERMINATED_BY_CONFIG') return 'Completed';
    return 'Ready';
  }
