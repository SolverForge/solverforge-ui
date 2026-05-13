// --------------------------------------------------------------------------
// Global Window Extensions
// --------------------------------------------------------------------------

declare global {
	interface Window {
		SF: unknown;
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
	 * Common interface implemented by all backend adapters.
	 */
	interface Backend {
		createJob(data: unknown): Promise<string>;
		getJob(id: string): Promise<unknown>;
		getJobStatus(id: string): Promise<unknown>;
		getSnapshot(
			id: string,
			snapshotRevision?: string | number,
		): Promise<unknown>;
		analyzeSnapshot(
			id: string,
			snapshotRevision?: string | number,
		): Promise<unknown>;
		pauseJob(id: string): Promise<unknown>;
		resumeJob(id: string): Promise<unknown>;
		cancelJob(id: string): Promise<unknown>;
		deleteJob(id: string): Promise<unknown>;
		getDemoData(name: string): Promise<unknown>;
		listDemoData(): Promise<unknown>;
		streamJobEvents(
			id: string,
			onMessage: (event: SolverEvent) => void,
			onError?: (err: SseError) => void,
		): () => void;
	}

	interface BackendConfig {
		type?: string;
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
		snapshotRevision?: number;
		telemetry?: { movesPerSecond?: number; stepCount?: number };
		solution?: unknown;
		data?: { id?: string; jobId?: string };
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

export {};
