import type { Client } from 'discord.js'

import { ActivityType } from 'discord.js'

import packages from '../../package.json'

export const updateActivity = (client: Client<true>) => {
	client.user.setActivity(`v${packages.version} | ${client.guilds.cache.size}サーバー`, {
		type: ActivityType.Playing,
	})
}
