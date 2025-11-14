import type { ClientEvents } from 'discord.js'

export interface Event<EventName extends keyof ClientEvents = keyof ClientEvents> {
	name: EventName
	once: boolean
	execute: (...parameters: ClientEvents[EventName]) => Promise<void> | void
}
