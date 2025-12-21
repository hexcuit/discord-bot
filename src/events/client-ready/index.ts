import { Events } from 'discord.js'
import { logger } from '@/lib/logger'
import { updateActivity } from '@/lib/update-activity'
import type { Event } from '@/types/event'

export default {
	name: Events.ClientReady,
	once: true,

	execute: async (client) => {
		logger.info(`${client.user.tag} でログインしました！`)

		updateActivity(client)

		setInterval(
			() => {
				updateActivity(client)
			},
			60 * 60 * 1000,
		) // 1時間ごとにアクティビティを更新
	},
} satisfies Event<Events.ClientReady>
