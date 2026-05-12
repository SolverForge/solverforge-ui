declare global {
	interface Window {
		SF: unknown;
	}

	const Split: (
		elements: string[],
		options?: Record<string, unknown>,
	) => unknown;
	const Gantt: new (
		selector: string,
		tasks: unknown[],
		options?: Record<string, unknown>,
	) => unknown;

	interface HttpError extends Error {
		status?: number;
		statusText?: string;
		method?: string;
		path?: string;
		url?: string;
	}

	interface SseError extends Error {
		code?: string;
		transport?: string;
		url?: string;
	}

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
