import { loadConfig } from "../config";
import { getReviewInstructions } from "../skills/ponytail";

export interface CommandResult {
  text: string;
}

export function handleReview(_sessionId: string, _args: string): CommandResult {
  const cfg = loadConfig();

  if (!cfg.features.review) {
    return { text: "review feature disabled." };
  }

  return { text: getReviewInstructions() };
}
