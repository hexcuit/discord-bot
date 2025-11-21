import { Glob } from 'bun'
import { type Client, Events } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Event } from '@/types/event'

type RawEvent = {
	name: string
	once: boolean
	execute: (...args: unknown[]) => unknown
	[key: string]: unknown
}

const hasRequiredFields = (evt: unknown): evt is RawEvent => {
	if (!evt || typeof evt !== 'object') return false
	const obj = evt as Record<string, unknown>
	return typeof obj.name === 'string' && typeof obj.once === 'boolean' && typeof obj.execute === 'function'
}

const isValidDiscordEvent = (name: string): boolean => {
	const validEvents = Object.values(Events) as string[]
	if (!validEvents.includes(name)) {
		logger.warn(`Unknown Discord.js event: ${name}`)
		return false
	}
	return true
}

const isValidEvent = (evt: unknown): evt is Event => {
	if (!hasRequiredFields(evt)) return false
	if (!isValidDiscordEvent(evt.name)) return false
	return true
}

type LoadResult = {
	file: string
	event: Event | null
	error?: unknown
}

export const loadEvents = async (client: Client): Promise<void> => {
	const glob = new Glob('*/index.{js,ts}')
	const dir = `${import.meta.dir}/../events`

	const eventFiles = await Array.fromAsync(glob.scan(dir))

	const loadResults = await Promise.all(
		eventFiles.map(async (file): Promise<LoadResult> => {
			try {
				const eventModule = await import(`${dir}/${file}`)
				const event = eventModule.default

				if (!event) {
					logger.error(`Event file ${file} does not export a default event`)
					return { file, event: null }
				}

				if (!isValidEvent(event)) {
					logger.error(`Invalid event structure: ${file}`)
					return { file, event: null }
				}

				return { file, event }
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				logger.error(`Failed to load event ${file}:`, errorMessage)
				return { file, event: null, error }
			}
		}),
	)

	let loadedCount = 0
	let failedCount = 0

	loadResults.forEach((result) => {
		if (result.event) {
			const { event } = result

			if (event.once) {
				client.once(event.name, (...parameters) => {
					try {
						return event.execute(...parameters)
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error)
						logger.error(`Error in event ${event.name}:`, errorMessage)
					}
				})
			} else {
				client.on(event.name, (...parameters) => {
					try {
						return event.execute(...parameters)
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error)
						logger.error(`Error in event ${event.name}:`, errorMessage)
					}
				})
			}

			loadedCount++
		} else {
			failedCount++
		}
	})

	logger.info(`Events loaded: ${loadedCount} succeeded, ${failedCount} failed`)
}
