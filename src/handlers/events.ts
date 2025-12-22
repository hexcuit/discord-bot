import { type Client, Events } from 'discord.js'
import * as events from '@/events'
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

export const loadEvents = (client: Client): void => {
	const eventList = Object.values(events) as unknown[]

	let loadedCount = 0
	let failedCount = 0

	for (const rawEvent of eventList) {
		if (!rawEvent) {
			failedCount++
			continue
		}

		if (!isValidEvent(rawEvent)) {
			logger.error('Invalid event structure')
			failedCount++
			continue
		}

		const event = rawEvent
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
	}

	logger.info(`Events loaded: ${loadedCount} succeeded, ${failedCount} failed`)
}
