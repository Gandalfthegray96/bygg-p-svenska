declare module "bun:test" {
  export const test: (name: string, fn: () => void) => void;
  export const expect: (v: unknown) => { toBe: (x: unknown) => void };
}
