import { Client, GatewayIntentBits } from 'discord.js'
import { loadCommands } from '@/handlers/commands'
import { loadEvents } from '@/handlers/events'

const main = () => {
	const client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
	})

	client.commands = loadCommands()

	loadEvents(client)

	client.login(process.env.DISCORD_TOKEN)
}

main()
