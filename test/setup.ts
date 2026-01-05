/**
 * Test environment setup for discord-bot
 * This file is preloaded before all tests via bunfig.toml
 */
import { afterAll, beforeAll } from 'bun:test'

// Suppress console output during tests unless explicitly needed
const originalConsole = { ...console }

beforeAll(() => {
	console.log = () => {}
	console.info = () => {}
	console.debug = () => {}
})

afterAll(() => {
	console.log = originalConsole.log
	console.info = originalConsole.info
	console.debug = originalConsole.debug
})
