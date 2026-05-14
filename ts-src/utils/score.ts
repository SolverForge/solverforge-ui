/* ============================================================================
   SolverForge UI — Score Parsing
   ============================================================================ */

(function (sf) {
  'use strict';

  sf.score = {};

  sf.score.parseHard = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)hard/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.parseSoft = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)soft/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.parseMedium = function (scoreStr) {
    if (!scoreStr) return 0;
    var m = scoreStr.match(/(-?\d+)medium/);
    return m ? parseInt(m[1], 10) : 0;
  };

  sf.score.getComponents = function (scoreStr) {
    return {
      hard: sf.score.parseHard(scoreStr),
      medium: sf.score.parseMedium(scoreStr),
      soft: sf.score.parseSoft(scoreStr),
    };
  };

  sf.score.colorClass = function (scoreStr) {
    var hard = sf.score.parseHard(scoreStr);
    var soft = sf.score.parseSoft(scoreStr);
    return hard < 0 ? 'score-red' : soft < 0 ? 'score-yellow' : 'score-green';
  };

})(SF);
