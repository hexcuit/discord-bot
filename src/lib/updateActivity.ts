import type { Client } from 'discord.js'
import { ActivityType } from 'discord.js'
import packages from '../../package.json'

export function updateActivity(client: Client<true>) {
	const guildCount = client.guilds.cache.size
	client.user.setActivity(`v${packages.version} | ${guildCount}サーバー`, {
		type: ActivityType.Playing,
	})
}
