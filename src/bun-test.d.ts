declare module "bun:test" {
  export const mock: { module: (path: string, factory: () => Record<string, unknown>) => void };
  export const test: (name: string, fn: () => void) => void;
  export const expect: (v: unknown) => { toBe: (x: unknown) => void };
}
