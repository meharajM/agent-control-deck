export { happyPath } from "./scenarios/happy-path.js";
export { reconnect } from "./scenarios/reconnect.js";
export { duplicateCommand } from "./scenarios/duplicate-command.js";
export type { Scenario, ScenarioStep, ScenarioEvent } from "./scenario-types.js";

import { happyPath } from "./scenarios/happy-path.js";
import { reconnect } from "./scenarios/reconnect.js";
import { duplicateCommand } from "./scenarios/duplicate-command.js";
import type { Scenario } from "./scenario-types.js";

/** All registered scenarios. */
export const allScenarios: Scenario[] = [happyPath, reconnect, duplicateCommand];
