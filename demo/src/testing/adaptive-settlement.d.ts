export declare function observeDrawerSettlement(host: unknown): {
  wait(): Promise<
    | {
        elapsedMs: number
        state: number
        events: { event: string; at: number; state: number }[]
      }
    | undefined
  >
  dispose(): void
}
