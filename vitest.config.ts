import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'@/': new URL('./src/', import.meta.url).pathname,
			'@test/': new URL('./mocks/', import.meta.url).pathname,
		},
	},
	test: {
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.d.ts',
				'src/commands/index.ts',
				'src/events/index.ts',
			],
			reporter: ['text', 'lcov'],
		},
	},
})
