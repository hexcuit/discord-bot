import { ActivityType, Client, GatewayIntentBits } from 'discord.js'
import { loadCommands } from '@/handlers/commands'
import { loadEvents } from '@/handlers/events'
import version from '../package.json'

// 新しいClientインスタンスを作成
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
	presence: {
		activities: [
			{
				name: `v${version.version}`,
				type: ActivityType.Custom,
			},
		],
		status: 'online',
	},
})

client.commands = await loadCommands()

await loadEvents(client)

client.login(import.meta.env.DISCORD_TOKEN)
