import { Events } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Event } from '@/types/event'

export default {
	name: Events.GuildCreate,
	once: false,

	execute: async (guild) => {
		logger.info(`新しいサーバーに参加: ${guild.name} (ID: ${guild.id})`)
	},
} satisfies Event<Events.GuildCreate>
