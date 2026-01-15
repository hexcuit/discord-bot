import { Events } from 'discord.js'

import type { Event } from '@/types/event'

import { updateActivity } from '@/lib/update-activity'

export default {
	name: Events.GuildDelete,
	once: false,

	execute: async (guild) => {
		updateActivity(guild.client)
	},
} satisfies Event<Events.GuildDelete>
