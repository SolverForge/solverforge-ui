/* ============================================================================
   SolverForge UI — API Types
   Types shared between solver backend and lifecycle management.
   ============================================================================ */

// ------------------------------------------------------------------------
// Backend
// ------------------------------------------------------------------------

/**
 * Minimum contract required by SF.createSolver().
 * Custom backends only need to implement these methods.
 */
export interface SolverBackend {
	createJob(data: unknown): Promise<string | number | {
		id?: string | number;
		jobId?: string | number;
		job_id?: string | number;
		data?: { id?: string | number };
	}>;
	getSnapshot(id: string, snapshotRevision?: string | number): Promise<unknown>;
	analyzeSnapshot(id: string, snapshotRevision?: string | number): Promise<unknown>;
	pauseJob(id: string): Promise<unknown>;
	resumeJob(id: string): Promise<unknown>;
	cancelJob(id: string): Promise<unknown>;
	deleteJob(id: string): Promise<unknown>;
	streamJobEvents(
		id: string,
		onMessage: (payload: SolverEvent) => void,
		onError?: (err: Error) => void,
	): () => void;
}

/**
 * Full built-in adapter shape returned by SF.createBackend().
 * Adds convenience methods not required by createSolver().
 */
export interface BackendAdapter extends SolverBackend {
	getJob(id: string): Promise<unknown>;
	getJobStatus(id: string): Promise<unknown>;
	getDemoData(name: string): Promise<unknown>;
	listDemoData(): Promise<unknown>;
}

export type BackendConfig = HttpBackendConfig | TauriBackendConfig;

export interface HttpBackendConfig {
	type?: string;  // 'axum' | 'fetch' | 'rails' | custom plugins
	baseUrl?: string;
	jobsPath?: string;
	demoDataPath?: string;
	headers?: Record<string, string>;
}

export interface TauriBackendConfig {
	type: "tauri";
	invoke: (
		command: string,
		payload?: Record<string, unknown>,
	) => Promise<unknown>;
	listen: (
		event: string,
		handler: (event: { payload: SolverEvent }) => void,
	) => Promise<() => void>;
	commands?: Partial<Record<string, string>>;
	eventName?: string;
}

// ------------------------------------------------------------------------
// Backend Payload Types
// ------------------------------------------------------------------------

/**
 * Recursive type for backend payloads that can have nested data/metadata.
 * Used for normalizeJobEvent, normalizeSnapshot, normalizeAnalysis.
 */
export interface BackendPayload extends Record<string, unknown> {
	[key: string]: unknown | BackendPayload;
	data?: BackendPayload;
	metadata?: BackendPayload;
	solution?: unknown;
	error?: string;
	eventType?: string;
	jobId?: string;
	id?: string;
	eventSequence?: number;
	lifecycleState?: string;
	currentScore?: string | number;
	bestScore?: string | number;
	snapshotRevision?: number | string;
	terminalReason?: string;
	telemetry?: SolverTelemetry | BackendPayload;
}

// ------------------------------------------------------------------------
// Internal Solver Types
// ------------------------------------------------------------------------

/**
 * Internal solver phase - mirrors Rust lifecycle with client-side transitions.
 * Rust: SolverLifecycleState (Solving, PauseRequested, Paused, Completed, Cancelled, Failed)
 * JS adds: idle, starting, resuming, cancelling
 */
export type SolverPhase =
	| 'idle'
	| 'starting'
	| 'solving'
	| 'pause-requested'
	| 'paused'
	| 'resuming'
	| 'cancelling';

	
/**
 * Deferred promise for async operations (pause, resume, cancel).
 */
export interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
}

/**
 * Terminal sync status for completed/cancelled/failed events.
 */
export type TerminalSyncStatus = 'pending' | 'synced' | 'failed';

/**
 * Record for tracking terminal synchronization state.
 * Used to ensure snapshot/analysis sync completes before delete is allowed.
 */
export interface TerminalSyncRecord {
	jobId: string;
	eventType: string;
	meta: EventMeta;
	status: TerminalSyncStatus;
	promise: Promise<unknown> | null;
	error: Error | null;
	callbackDelivered: boolean;
}

/**
 * Normalized job event from backend payload.
 */
export interface NormalizedJobEvent {
	eventType: string;
	meta: EventMeta;
	solution: unknown | null;
	error: string | null;
}

// ------------------------------------------------------------------------
// Solver Event Types
// ------------------------------------------------------------------------

/**
 * Telemetry data from the solver runtime.
 */
export interface SolverTelemetry extends Record<string, unknown> {
	[key: string]: unknown;
}

/**
 * Canonical SSE/IPC event payload from the solver runtime.
 */
export interface SolverEvent {
	eventType: string;
	jobId?: string;
	job_id?: string;
	id?: string;
	eventSequence?: number;
	lifecycleState?: string;
	currentScore?: string;
	bestScore?: string;
	snapshotRevision?: number | string;
	telemetry?: SolverTelemetry;
	solution?: unknown;
	data?: { id?: string; jobId?: string };
}

// ------------------------------------------------------------------------
// Solver Core Types
// ------------------------------------------------------------------------

/**
 * Union type for all valid solver lifecycle states.
 */
export type LifecycleState =
	| 'IDLE'
	| 'STARTING'
	| 'SOLVING'
	| 'PAUSE_REQUESTED'
	| 'PAUSED'
	| 'RESUMING'
	| 'CANCELLING'
	| 'COMPLETED'
	| 'CANCELLED'
	| 'FAILED'
	| 'TERMINATED_BY_CONFIG';

/**
 * Metadata attached to solver events.
 */
export interface EventMeta {
	id: string;
	jobId: string;
	eventType: string;
	eventSequence: number | null;
	lifecycleState: LifecycleState;
	terminalReason: string | null;
	telemetry: SolverTelemetry | null;
	currentScore: string | null;
	bestScore: string | null;
	snapshotRevision: number | string | null;
}

/**
 * A point-in-time snapshot of solver state.
 */
export interface SolverSnapshot {
	id: string | null;
	jobId: string | null;
	snapshotRevision: number | string | null;
	lifecycleState: LifecycleState | null;
	terminalReason: string | null;
	currentScore: string | null;
	bestScore: string | null;
	telemetry: SolverTelemetry | null;
	solution: unknown | null;
}

/**
 * Analysis results for a solver snapshot.
 */
export interface SolverAnalysis {
	jobId: string | null;
	snapshotRevision: number | string | null;
	lifecycleState: LifecycleState | null;
	terminalReason: string | null;
	analysis: unknown | null;
	score: string | number | null;
	constraints: unknown[] | null;
}

// ------------------------------------------------------------------------
// Solver Configuration & API
// ------------------------------------------------------------------------

export interface SolverConfig {
	backend: SolverBackend;
	statusBar?: {
		setLifecycleState?: (state: LifecycleState) => void;
		setSolving?: (solving: boolean) => void;
		updateScore?: (score: string | number | null) => void;
		updateMoves?: (value: number | null) => void;
		colorDotsFromAnalysis?: (constraints: unknown[]) => void;
	};
	onProgress?: (meta?: EventMeta) => void;
	onSolution?: (snapshot?: SolverSnapshot, meta?: EventMeta) => void;
	onPauseRequested?: (meta?: EventMeta) => void;
	onPaused?: (snapshot?: SolverSnapshot, meta?: EventMeta) => void;
	onResumed?: (meta?: EventMeta) => void;
	onComplete?: (snapshot?: SolverSnapshot, meta?: EventMeta) => void;
	onCancelled?: (snapshot?: SolverSnapshot | null, meta?: EventMeta) => void;
	onFailure?: (
		error?: string,
		meta?: EventMeta,
		snapshot?: SolverSnapshot | null,
		analysis?: SolverAnalysis | null,
	) => void;
	onAnalysis?: (analysis?: SolverAnalysis, meta?: EventMeta) => void;
	onError?: (message?: string) => void;
}

export interface SolverApi {
	start(data?: unknown): Promise<void>;
	pause(): Promise<{ snapshot: SolverSnapshot | null; meta: EventMeta; analysis: SolverAnalysis | null } | void>;
	resume(): Promise<EventMeta | void>;
	cancel(): Promise<{ snapshot: SolverSnapshot | null; meta: EventMeta; analysis: SolverAnalysis | null } | void>;
	delete(): Promise<void>;
	getSnapshot(snapshotRevision?: number | string): Promise<SolverSnapshot | null>;
	analyzeSnapshot(snapshotRevision?: number | string): Promise<SolverAnalysis | null>;
	isRunning(): boolean;
	getJobId(): string | null;
	getLifecycleState(): LifecycleState;
	getSnapshotRevision(): number | string | null;
}

/* ============================================================================
   SolverForge UI — Backend Types
   Type definitions used only in backend.ts
   ============================================================================ */

/**
 * HTTP error with status information.
 */
export interface HTTPError extends Error {
	status: number;
	statusText: string;
	method: string;
	path: string;
	url: string;
}

/**
 * Server-Sent Events error with transport information.
 */
export interface SSEError extends Error {
	code: string;
	transport: string;
	url: string;
}
