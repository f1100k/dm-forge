// The web integration tests import apps/web modules (routes → Better Auth client
// → env.ts), which read `import.meta.env`. Vite's client types aren't a dependency
// of this test package, so declare the minimal shape here to keep the shared type
// program compiling. Runtime values are provided by Vitest's Vite pipeline.
interface ImportMeta {
  readonly env: Record<string, string | undefined>
}
