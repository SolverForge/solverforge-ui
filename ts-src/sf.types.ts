// ------------------------------------------------------------------------
// Global API
// ------------------------------------------------------------------------
import type { BackendConfig, BackendAdapter, SolverConfig, SolverApi } from "./solver/api.types";
import type { createApiGuide } from "./components/api-guide";
import type { createButton } from "./components/buttons";
import type { createFooter } from "./components/footer";
import type { createHeader } from "./components/header";
import type { createModal } from "./components/modal";
import type { createStatusBar } from "./components/statusbar";
import type { createTable } from "./components/table";
import type { createTabs, showTab } from "./components/tabs";
import type { showError, showToast } from "./components/toast";
import type { assert, bindActivation, el, escHtml, normalizeCreateJobId, uid } from "./core";
import type * as ColorsApi from "./utils/colors";
import type * as GanttApi from "./gantt";
import type * as RailApi from "./rail";
import type * as ScoreApi from "./utils/score";

export interface GlobalAPI {
	version: string;
	assert: typeof assert;
	bindActivation: typeof bindActivation;
	colors: typeof ColorsApi;
	createApiGuide: typeof createApiGuide;
	createBackend: (config?: BackendConfig | null) => BackendAdapter;
	createButton: typeof createButton;
	createFooter: typeof createFooter;
	createHeader: typeof createHeader;
	createModal: typeof createModal;
	createSolver: (config: SolverConfig) => SolverApi;
	createStatusBar: typeof createStatusBar;
	createTable: typeof createTable;
	createTabs: typeof createTabs;
	el: typeof el;
	escHtml: typeof escHtml;
	gantt: typeof GanttApi.gantt;
	normalizeCreateJobId: typeof normalizeCreateJobId;
	rail: typeof RailApi.rail;
	score: typeof ScoreApi;
	showError: typeof showError;
	showTab: typeof showTab;
	showToast: typeof showToast;
	uid: typeof uid;
}
