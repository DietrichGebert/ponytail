import type { PonytailMode } from "./config";

interface PonytailState {
  currentMode: PonytailMode;
}

const stateMap = new Map<string, PonytailState>();

function getState(sessionId: string): PonytailState {
  if (!stateMap.has(sessionId)) {
    stateMap.set(sessionId, { currentMode: "off" });
  }
  return stateMap.get(sessionId)!;
}

export function setMode(sessionId: string, mode: PonytailMode): void {
  const state = getState(sessionId);
  state.currentMode = mode;
}

export function getMode(sessionId: string): PonytailMode {
  return getState(sessionId).currentMode;
}
