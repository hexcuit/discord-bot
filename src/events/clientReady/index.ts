import { Events } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Event } from '@/types/event'

export default {
	name: Events.ClientReady,
	once: true,

	execute: async (client) => {
		logger.info(`${client.user.tag} でログインしました！`)
	},
} satisfies Event<Events.ClientReady>
