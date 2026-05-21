// IIFE — window.SF unchanged for existing integrators

import * as colorsApi from "./utils/colors";
import * as scoreApi from "./utils/score";

export * from "./core/index";
export * from "./components/api-guide";
export * from "./components/buttons";
export * from "./components/footer";
export * from "./components/header";
export * from "./components/modal";
export * from "./components/statusbar";
export * from "./components/table";
export * from "./components/tabs";
export * from "./components/toast";
export * from "./gantt/index";
export * from "./rail/index";
export * from "./solver/backend";
export * from "./solver/solver";
export * from "./utils/colors";
export * from "./utils/score";

// Retain the shipped classic API namespaces while also exposing flat ESM
// named exports from the utility modules above.
export const colors = {
  pick: colorsApi.pick,
  project: colorsApi.project,
  reset: colorsApi.reset,
};

export const score = {
  parseHard: scoreApi.parseHard,
  parseSoft: scoreApi.parseSoft,
  parseMedium: scoreApi.parseMedium,
  getComponents: scoreApi.getComponents,
  colorClass: scoreApi.colorClass,
};
