import { Events } from 'discord.js'
import { logger } from '@/lib/logger'
import { updateActivity } from '@/lib/updateActivity'
import type { Event } from '@/types/event'

export default {
	name: Events.ClientReady,
	once: true,

	execute: async (client) => {
		logger.info(`${client.user.tag} でログインしました！`)

		updateActivity(client)
	},
} satisfies Event<Events.ClientReady>
