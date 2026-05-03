import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'unit:shared',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
