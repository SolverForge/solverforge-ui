// --------------------------------------------------------------------------
// Global Window Extensions
// SolverForge UI - TypeScript Type Definitions
// Aligned with Rust solverforge-solver crate types
// --------------------------------------------------------------------------

declare global {
	interface Window {
		SF: SF.GlobalAPI;
	}

	namespace SF {
		interface GlobalAPI {
			version: string;
			createBackend: (config: BackendConfig) => BackendAdapter;
			createSolver: (config: SolverConfig) => SolverApi;
			assert: (value: unknown, message: string) => void;
			normalizeCreateJobId: (id: unknown) => string;
		}
	}

	// ------------------------------------------------------------------------
	// Error Types
	// ------------------------------------------------------------------------

	interface HttpError extends Error {
		status: number;
		statusText: string;
		method: string;
		path: string;
		url: string;
	}

	interface SseError extends Error {
		code: string;
		transport: string;
		url: string;
	}

	// ------------------------------------------------------------------------
	// Backend
	// ------------------------------------------------------------------------

	/**
	 * Minimum contract required by SF.createSolver().
	 * Custom backends only need to implement these methods.
	 */
	interface SolverBackend {
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
			onError?: (err: SseError) => void,
		): () => void;
	}

	/**
	 * Full built-in adapter shape returned by SF.createBackend().
	 * Adds convenience methods not required by createSolver().
	 */
	interface BackendAdapter extends SolverBackend {
		getJob(id: string): Promise<unknown>;
		getJobStatus(id: string): Promise<unknown>;
		getDemoData(name: string): Promise<unknown>;
		listDemoData(): Promise<unknown>;
	}

	interface BackendConfig {
		type?: string | null;
	}

	interface HttpBackendConfig extends BackendConfig {
		type?: "axum" | "fetch";
		baseUrl?: string;
		jobsPath?: string;
		demoDataPath?: string;
		headers?: Record<string, string>;
	}

	interface TauriBackendConfig extends BackendConfig {
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
	// Solver Event Types
	// ------------------------------------------------------------------------

	/**
	 * Canonical SSE/IPC event payload from the solver runtime.
	 */
	interface SolverEvent {
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
	type LifecycleState =
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
	interface EventMeta {
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
	interface SolverSnapshot {
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
	interface SolverAnalysis {
		jobId: string | null;
		snapshotRevision: number | string | null;
		lifecycleState: LifecycleState | null;
		terminalReason: string | null;
		analysis: unknown | null;
		score: string | number | null;
		constraints: unknown[] | null;
	}

	// ------------------------------------------------------------------------
	// Internal Solver Types
	// ------------------------------------------------------------------------

	/**
	 * Internal solver phase - mirrors Rust lifecycle with client-side transitions.
	 * Rust: SolverLifecycleState (Solving, PauseRequested, Paused, Completed, Cancelled, Failed)
	 * JS adds: idle, starting, resuming, cancelling
	 */
	type SolverPhase =
		| 'idle'
		| 'starting'
		| 'solving'
		| 'pause-requested'
		| 'paused'
		| 'resuming'
		| 'cancelling';

	/**
	 * Terminal reason types.
	 */
	type TerminalReason =
		| 'completed'
		| 'terminated_by_config'
		| 'cancelled'
		| 'failed'
		| null;

	/**
	 * Deferred promise for async operations (pause, resume, cancel).
	 */
	interface Deferred<T> {
		promise: Promise<T>;
		resolve: (value: T) => void;
		reject: (error: Error) => void;
	}

	/**
	 * Terminal sync status for completed/cancelled/failed events.
	 */
	type TerminalSyncStatus = 'pending' | 'synced' | 'failed';

	/**
	 * Record for tracking terminal synchronization state.
	 * Used to ensure snapshot/analysis sync completes before delete is allowed.
	 */
	interface TerminalSyncRecord {
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
	interface NormalizedJobEvent {
		eventType: string;
		meta: EventMeta;
		solution: unknown | null;
		error: string | null;
	}

	/**
	 * Telemetry data structure.
	 */
	interface SolverTelemetry {
		movesPerSecond?: number;
		stepCount?: number;
		elapsedMs?: number;
		movesGenerated?: number;
		movesEvaluated?: number;
		movesAccepted?: number;
		movesApplied?: number;
		scoreCalculations?: number;
	}

	// ------------------------------------------------------------------------
	// Solver Configuration & API
	// ------------------------------------------------------------------------

	interface SolverConfig {
		backend: SolverBackend;
		statusBar?: {
			setLifecycleState?: (state: LifecycleState) => void;
			setSolving?: (solving: boolean) => void;
			updateScore?: (score: string | number | null) => void;
			updateMoves?: (value: number | null) => void;
			colorDotsFromAnalysis?: (constraints: unknown[]) => void;
		};
		onProgress?: (meta: EventMeta) => void;
		onSolution?: (snapshot: SolverSnapshot, meta: EventMeta) => void;
		onPauseRequested?: (meta: EventMeta) => void;
		onPaused?: (snapshot: SolverSnapshot, meta: EventMeta) => void;
		onResumed?: (meta: EventMeta) => void;
		onComplete?: (snapshot: SolverSnapshot, meta: EventMeta) => void;
		onCancelled?: (snapshot: SolverSnapshot | null, meta: EventMeta) => void;
		onFailure?: (
			error: string,
			meta: EventMeta,
			snapshot: SolverSnapshot | null,
			analysis: SolverAnalysis | null,
		) => void;
		onAnalysis?: (analysis: SolverAnalysis, meta: EventMeta) => void;
		onError?: (message: string) => void;
	}

	interface SolverApi {
		start(data?: unknown): Promise<void>;
		pause(): Promise<{ snapshot: SolverSnapshot | null; meta: EventMeta; analysis: SolverAnalysis | null } | null>;
		resume(): Promise<EventMeta | null>;
		cancel(): Promise<{ snapshot: SolverSnapshot | null; meta: EventMeta; analysis: SolverAnalysis | null } | null>;
		delete(): Promise<void>;
		getSnapshot(snapshotRevision?: number | string): Promise<SolverSnapshot | null>;
		analyzeSnapshot(snapshotRevision?: number | string): Promise<SolverAnalysis | null>;
		isRunning(): boolean;
		getJobId(): string | null;
		getLifecycleState(): LifecycleState;
		getSnapshotRevision(): number | string | null;
	}

	// ------------------------------------------------------------------------
	// UI Components
	// ------------------------------------------------------------------------

	const Split: (
		elements: string[],
		options?: Record<string, unknown>,
	) => unknown;

	const Gantt: new (
		selector: string,
		tasks: unknown[],
		options?: Record<string, unknown>,
	) => unknown;

	interface RailOverviewGroup {
		clusterId: string | null;
		clusterKey: string | null;
		count: number;
		detailItems: unknown[];
		endMinute: number;
		isCluster: boolean;
		items: unknown[];
		label: string;
		lane: unknown;
		metaLabel: string;
		renderId: string;
		startMinute: number;
		summary: {
			count: number;
			openCount: number | null;
			primaryLabel: string;
			primaryTone: unknown;
			secondaryLabel: string;
			toneSegments: unknown[];
		};
		tone: unknown;
	}
}

export { };
