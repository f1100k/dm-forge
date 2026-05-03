import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'unit:ai',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
