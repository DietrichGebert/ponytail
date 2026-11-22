export type Tests = {
  state: 'none' | 'pass' | 'fail' | 'stale'
  passed?: number
  failed?: number
}

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

// One rate-limit window as `$.session.usage()` reports it.
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

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
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    ponytail: { band: Band }
  }
}
