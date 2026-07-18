import type { UcpCapabilities } from "../capabilities.js";

/** All capabilities set to false — baseline fixture for contract tests. */
export const validCapabilities: UcpCapabilities = {
  send: false,
  steerInFlight: false,
  cancel: false,
  retry: false,
  resume: false,
  fork: false,
  approvals: {
    command: false,
    fileChange: false,
    network: false,
    filesystem: false,
    genericTool: false,
    approveForSession: false,
    modifyBeforeApproval: false,
  },
  questions: {
    singleChoice: false,
    multiSelect: false,
    freeText: false,
  },
  previews: {
    diff: false,
    tests: false,
    commands: false,
    files: false,
    rawTranscript: false,
  },
  skills: false,
  macros: false,
};
