// --------------------------------------------------------------------------
// Global Window Extensions
// SolverForge UI - TypeScript Type Definitions
// --------------------------------------------------------------------------

import type { GlobalAPI } from "./sf.types";

declare global {
	interface Window {
		SF: GlobalAPI;
	}
	// External library types loaded globally
	const Split: (
		elements: string[],
		options?: Record<string, unknown>,
	) => unknown;
	const Gantt: new (
		selector: string,
		tasks: unknown[],
		options?: Record<string, unknown>,
	) => unknown;
}

export {};
