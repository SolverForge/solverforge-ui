/* ============================================================================
 * PUBLIC API TYPES
 * ========================================================================== */

export interface TimelineConfig {
  model: TimelineModel;

  title?: string;
  subtitle?: string;
  label?: string;

  labelWidth?: number;

  zoomPresets?: ZoomPreset[];

  onClusterToggle?: (
    laneId: string,
    clusterId: string | null
  ) => void;
}

export type ZoomPreset =
  | '1w'
  | '2w'
  | '4w'
  | 'reset';

export interface TimelineApi {
  el: HTMLElement;

  destroy(): void;

  expandCluster(
    laneId: string,
    clusterId: string | null
  ): void;

  setModel(nextModel: TimelineModel): void;

  setViewport(nextViewport: TimelineViewport): void;
}

/* ============================================================================
 * MODEL
 * ========================================================================== */

export interface TimelineModel {
  axis: TimelineAxis;
  lanes: TimelineLane[];
}

export interface TimelineAxis {
  startMinute: number;
  endMinute: number;

  days?: TimelineDay[];
  ticks?: TimelineTick[];

  initialViewport?: TimelineViewport;
}

export interface TimelineViewport {
  startMinute: number;
  endMinute: number;
}

/* ============================================================================
 * AXIS
 * ========================================================================== */

export type TimelineDay =
  | string
  | TimelineDayObject;

export interface TimelineDayObject {
  id?: string;

  startMinute?: number;
  endMinute?: number;

  label?: string;
  subLabel?: string;
  meta?: string;

  isWeekend?: boolean;
}

export type TimelineTick =
  | number
  | TimelineTickObject;

export interface TimelineTickObject {
  id?: string;

  minute: number;

  label?: string;
}

/* ============================================================================
 * LANES
 * ========================================================================== */

export interface TimelineLane {
  id?: string;

  label?: string;

  mode?: 'overview' | 'detailed';

  items: TimelineItem[];

  overlays?: TimelineOverlay[];

  badges?: TimelineBadge | TimelineBadge[];

  stats?: TimelineStat[];
}

export interface TimelineStat {
  label: string;
  value: string | number;
}

export type TimelineBadge =
  | string
  | TimelineBadgeObject;

export interface TimelineBadgeObject {
  label: string;

  style?: {
    bg?: string;
    border?: string;
    color?: string;
  };
}

/* ============================================================================
 * ITEMS
 * ========================================================================== */

export interface TimelineItem {
  id?: string;

  startMinute: number;
  endMinute: number;

  label?: string;

  meta?: TimelineMeta;

  tone?: TimelineToneInput;
  color?: TimelineToneInput;

  clusterId?: string;

  detailItems?: TimelineItem[];

  summary?: TimelineOverviewSummary;
}

export type TimelineMeta =
  | string
  | number
  | Record<string, unknown>
  | TimelineMetaEntry[];

export interface TimelineMetaEntry {
  label?: string;
  value?: unknown;
}

/* ============================================================================
 * OVERVIEW SUMMARY
 * ========================================================================== */

export interface TimelineOverviewSummary {
  count?: number;

  openCount?: number;

  primaryLabel?: string;
  secondaryLabel?: string;

  toneSegments?: TimelineToneSegment[];
}

export interface TimelineToneSegment {
  count: number;

  tone?: TimelineToneInput;
  color?: TimelineToneInput;
}

/* ============================================================================
 * OVERLAYS
 * ========================================================================== */

export interface TimelineOverlay {
  id?: string;

  label?: string;
  meta?: string;

  startMinute?: number;
  endMinute?: number;

  dayIndex?: number;
  dayCount?: number;

  tone?: TimelineToneInput;
  color?: TimelineToneInput;
}

/* ============================================================================
 * TONES
 * ========================================================================== */

export type TimelineToneInput =
  | TimelineToneName
  | string
  | TimelineToneObject;

export type TimelineToneName =
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'cyan'
  | 'red'
  | 'slate';

export interface TimelineToneObject {
  id?: string;
  name?: string;

  background?: string;
  bg?: string;

  border?: string;
  borderColor?: string;

  overlay?: string;
  band?: string;

  text?: string;
  textColor?: string;
  foreground?: string;

  color?: string;
}
