import { Events } from 'discord.js'

import type { Event } from '@/types/event'

import { logger } from '@/lib/logger'
import { updateActivity } from '@/lib/update-activity'

export default {
	name: Events.ClientReady,
	once: true,

	execute: async (client) => {
		logger.info(`Logged in as ${client.user.tag}!`)

		updateActivity(client)

		setInterval(
			() => {
				updateActivity(client)
			},
			60 * 60 * 1000,
		) // Update activity every hour
	},
} satisfies Event<Events.ClientReady>
