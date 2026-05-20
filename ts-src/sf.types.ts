// ------------------------------------------------------------------------
// Global API
// ------------------------------------------------------------------------
import {BackendConfig, BackendAdapter, SolverConfig, SolverApi} from "./solver/api.types";

export interface GlobalAPI {
	version: string;
	createBackend: (config?: BackendConfig) => BackendAdapter;
	createSolver: (config: SolverConfig) => SolverApi;
}

