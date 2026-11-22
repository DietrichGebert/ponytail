export type Tests = {
  state: 'none' | 'pass' | 'fail' | 'stale'
  passed?: number
  failed?: number
}

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type Band = {
  level: string
  // A level picked in the band that applies with the next prompt; '' when none.
  pending: string
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
}

declare module 'claude-code' {
  interface PluginState {
    ponytail: { band: Band }
  }
}
