export type Tests = {
  state: 'none' | 'pass' | 'fail' | 'stale'
  passed?: number
  failed?: number
}

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

// One row of /context's breakdown: what the context bar draws.
export type Seg = { name: string; tokens: number; color: string; kind: 'used' | 'free' | 'buffer' | 'deferred' }

export type Band = {
  level: string
  model: string
  cost: number
  spent: number
  turns: number
  turnCosts: number[]
  tokens: Tokens
  busyMs: number
  name: string
  project: string
  session: string
  transcript: string
  reused: string[]
  created: string[]
  removed: string[]
  openCallers: string[]
  tests: Tests
  details: boolean
  ctx: Seg[]
  // The window the breakdown measures against, in tokens (the panel's "/ 1M"); 0 before the first one.
  ctxMax: number
  // When Clear was pressed once, in $.clock.now() ms; armed for 5 s after, null when not.
  clearArmedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    ponytail: { band: Band }
  }
}
