import { sendCommand } from "./bridge-connection.js";

function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * Check if the device supports biometric authentication.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const LocalAuthentication = require("expo-local-authentication");
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication.
 * Returns true if authenticated, false if failed/cancelled.
 */
export async function promptBiometric(
  promptMessage = "Authenticate to continue"
): Promise<boolean> {
  try {
    const LocalAuthentication = require("expo-local-authentication");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export function approveApproval(
  approvalId: string,
  decision: string,
  expectedVersion: number,
): void {
  sendCommand("command/approve", {
    approvalId,
    decision,
    expectedVersion,
    idempotencyKey: generateIdempotencyKey(),
  });
}

/**
 * Approve an approval with biometric gate for high-risk decisions.
 */
export async function approveApprovalWithBiometric(
  approvalId: string,
  decision: string,
  expectedVersion: number,
  isHighRisk: boolean,
): Promise<void> {
  if (isHighRisk) {
    const biometricOk = await promptBiometric("Approve high-risk action");
    if (!biometricOk) {
      throw new Error("Biometric authentication required for high-risk approval");
    }
  }
  approveApproval(approvalId, decision, expectedVersion);
}

export function sendInstruction(sessionId: string, text: string): void {
  sendCommand("command/send", {
    sessionId,
    text,
    idempotencyKey: generateIdempotencyKey(),
  });
}

export function cancelSession(sessionId: string): void {
  sendCommand("command/cancel", {
    sessionId,
    idempotencyKey: generateIdempotencyKey(),
  });
}

export function answerQuestion(questionId: string, answer: unknown): void {
  sendCommand("command/answer", {
    questionId,
    answer,
    idempotencyKey: generateIdempotencyKey(),
  });
}
