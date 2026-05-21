/* ============================================================================
   SolverForge UI — Score Parsing
   ============================================================================ */

export const parseHard = function (scoreStr) {
  if (!scoreStr) return 0;
  var m = scoreStr.match(/(-?\d+)hard/);
  return m ? parseInt(m[1], 10) : 0;
};

export const parseSoft = function (scoreStr) {
  if (!scoreStr) return 0;
  var m = scoreStr.match(/(-?\d+)soft/);
  return m ? parseInt(m[1], 10) : 0;
};

export const parseMedium = function (scoreStr) {
  if (!scoreStr) return 0;
  var m = scoreStr.match(/(-?\d+)medium/);
  return m ? parseInt(m[1], 10) : 0;
};

export const getComponents = function (scoreStr) {
  return {
    hard: parseHard(scoreStr),
    medium: parseMedium(scoreStr),
    soft: parseSoft(scoreStr),
  };
};

export const colorClass = function (scoreStr) {
  var hard = parseHard(scoreStr);
  var soft = parseSoft(scoreStr);
  return hard < 0 ? 'score-red' : soft < 0 ? 'score-yellow' : 'score-green';
};
