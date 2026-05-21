import type { SolverEvent, SolverBackend } from "../../ts-src/solver/api.types";

const axumBackend = window.SF.createBackend({
	type: 'axum',
	baseUrl: '',
});

const fetchBackend = window.SF.createBackend({
	type: 'fetch',
	baseUrl: '/api/v1',
	headers: { 'X-CSRF-Token': 'token' },
});

const railsBackend = window.SF.createBackend({
	type: 'rails',
	baseUrl: '/api',
	jobsPath: '/jobs',
});

const aliasBackend = window.SF.createBackend({
	type: 'custom-http',
	baseUrl: '/solver',
});

const tauriBackend = window.SF.createBackend({
	type: 'tauri',
	invoke: async (_command: string, _payload?: Record<string, unknown>) => ({ id: 'job-1' }),
	listen: async (_event: string, _handler: (event: { payload: SolverEvent }) => void) => () => {},
	eventName: 'solver-update',
	commands: {
		createJob: 'create_job',
		getSnapshot: 'get_snapshot',
		analyzeSnapshot: 'analyze_snapshot',
		pauseJob: 'pause_job',
		resumeJob: 'resume_job',
		cancelJob: 'cancel_job',
		deleteJob: 'delete_job',
	},
});

const customSolverBackend: SolverBackend = {
	createJob: async () => ({ jobId: 0 }),
	getSnapshot: async () => ({ jobId: '0', snapshotRevision: 1, solution: {} }),
	analyzeSnapshot: async () => ({ jobId: '0', snapshotRevision: 1, analysis: { constraints: [] } }),
	pauseJob: async () => undefined,
	resumeJob: async () => undefined,
	cancelJob: async () => undefined,
	deleteJob: async () => undefined,
	streamJobEvents(_id, _onMessage, onError) {
		if (onError) onError(new Error('transport failed'));
		return () => {};
	},
};

const solver = window.SF.createSolver({ backend: customSolverBackend });

void axumBackend;
void fetchBackend;
void railsBackend;
void aliasBackend;
void tauriBackend;
void solver;
