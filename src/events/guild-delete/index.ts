import { Events } from 'discord.js'
import { updateActivity } from '@/lib/update-activity'
import type { Event } from '@/types/event'

export default {
	name: Events.GuildDelete,
	once: false,

	execute: async (guild) => {
		updateActivity(guild.client)
	},
} satisfies Event<Events.GuildDelete>
