import { ActivityType, Client, GatewayIntentBits } from 'discord.js'
import { loadCommands } from '@/loaders/commands'
import { loadEvents } from '@/loaders/events'
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

// コマンドを格納するコレクション
client.commands = await loadCommands()

await loadEvents(client)

client.login(Bun.env.DISCORD_TOKEN)
