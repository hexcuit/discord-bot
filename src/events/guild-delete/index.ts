import { Events } from 'discord.js'
import { logger } from '@/lib/logger'
import { updateActivity } from '@/lib/updateActivity'
import type { Event } from '@/types/event'

export default {
	name: Events.GuildDelete,
	once: false,

	execute: async (guild) => {
		logger.info(`サーバーから退出: ${guild.name} (ID: ${guild.id})`)
		updateActivity(guild.client)
	},
} satisfies Event<Events.GuildDelete>
