/* ============================================================================
   SolverForge UI — Status Bar Factory
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.createStatusBar = function (config) {
    var bar = sf.el('div', { className: 'sf-statusbar' });
    var lastScore = null;

    // Score display
    var scoreEl = sf.el('span', { className: 'sf-statusbar-score', id: 'sfScoreDisplay' }, '\u2014');
    bar.appendChild(scoreEl);

    // Separator
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));

    // Constraint dots container
    var dotsContainer = sf.el('div', { className: 'sf-statusbar-constraints', id: 'sfConstraintDots' });
    bar.appendChild(dotsContainer);

    // Separator + moves display
    var movesSep = sf.el('span', { className: 'sf-statusbar-sep', id: 'sfMovesSep' }, '|');
    movesSep.style.display = 'none';
    bar.appendChild(movesSep);

    var movesEl = sf.el('span', { id: 'sfMovesDisplay' });
    movesEl.style.display = 'none';
    bar.appendChild(movesEl);

    // Separator + status text
    bar.appendChild(sf.el('span', { className: 'sf-statusbar-sep' }, '|'));
    var statusEl = sf.el('span', { id: 'sfStatusText' });
    bar.appendChild(statusEl);

    // Build initial constraint dots
    if (config && config.constraints) {
      buildDots(dotsContainer, config.constraints, config.onConstraintClick);
    }

    var api = { el: bar };

    api.updateScore = function (scoreStr) {
      if (scoreStr && scoreStr !== lastScore) {
        scoreEl.textContent = scoreStr;
        var colorClass = sf.score.colorClass(scoreStr);
        scoreEl.classList.remove('improved', 'score-green', 'score-red', 'score-yellow');
        scoreEl.classList.add(colorClass);
        void scoreEl.offsetWidth;
        scoreEl.classList.add('improved');
        lastScore = scoreStr;
      } else if (!scoreStr) {
        scoreEl.textContent = '\u2014';
        scoreEl.classList.remove('score-green', 'score-red', 'score-yellow', 'improved');
      }
    };

    api.setSolving = function (solving) {
      var solveBtn = document.getElementById('sfSolveBtn');
      var stopBtn = document.getElementById('sfStopBtn');
      var spinner = document.getElementById('sfSolvingSpinner');

      if (solveBtn) solveBtn.style.display = solving ? 'none' : '';
      if (stopBtn) stopBtn.style.display = solving ? '' : 'none';
      if (spinner) spinner.classList.toggle('active', solving);

      statusEl.textContent = solving ? 'Solving\u2026' : 'Ready';
      statusEl.style.color = solving
        ? 'var(--sf-emerald-600)'
        : 'var(--sf-gray-500)';
    };

    api.updateMoves = function (mps) {
      if (mps != null && mps > 0) {
        movesEl.textContent = mps.toLocaleString() + ' moves/s';
        movesEl.style.display = '';
        movesSep.style.display = '';
      } else {
        movesEl.style.display = 'none';
        movesSep.style.display = 'none';
      }
    };

    api.updateConstraintDots = function (constraints) {
      buildDots(dotsContainer, constraints, config && config.onConstraintClick);
    };

    api.colorDotsByScore = function (scoreStr) {
      var hard = sf.score.parseHard(scoreStr);
      var soft = sf.score.parseSoft(scoreStr);
      dotsContainer.querySelectorAll('.sf-constraint-dot').forEach(function (dot) {
        var isHard = dot.dataset.type === 'hard';
        dot.classList.toggle('violated', isHard && hard < 0);
        dot.classList.toggle('violated-soft', !isHard && soft < 0);
      });
    };

    api.colorDotsFromAnalysis = function (constraints) {
      if (!constraints || constraints.length === 0) return;
      buildDots(dotsContainer, constraints, config && config.onConstraintClick);
      constraints.forEach(function (c, i) {
        var dot = document.getElementById('sf-cdot-' + i);
        if (!dot) return;
        var isHard = c.type === 'hard';
        var scoreVal = isHard ? sf.score.parseHard(c.score) : sf.score.parseSoft(c.score);
        var violated = scoreVal < 0;
        dot.classList.toggle('violated', isHard && violated);
        dot.classList.toggle('violated-soft', !isHard && violated);
      });
    };

    return api;
  };

  function buildDots(container, constraints, onClick) {
    container.innerHTML = '';
    if (!constraints) return;
    constraints.forEach(function (c, i) {
      var dot = sf.el('div', {
        className: 'sf-constraint-dot',
        id: 'sf-cdot-' + i,
        title: c.name || ('Constraint ' + i),
        dataset: { type: c.type || 'hard', index: String(i) },
      });
      if (onClick) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', function () { onClick(i); });
      }
      container.appendChild(dot);
    });
  }

})(SF);
