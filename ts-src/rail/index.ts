/** ============================================================================
   SolverForge UI — Rail Module Index
   Central export point for all rail-related functionality.
   ============================================================================ */

import { createHeader, createCard, createHeatmap, createUnassignedRail, addBlock, addChangeover } from "./card.ts";
import { createTimeline } from "./timeline.ts";

// Rail namespace object for backwards compatibility with SF.rail.*
// This provides SF.rail.createHeader, SF.rail.createTimeline, etc.
export const rail = {
  createHeader,
  createCard,
  createHeatmap,
  createUnassignedRail,
  addBlock,
  addChangeover,
  createTimeline,
};
