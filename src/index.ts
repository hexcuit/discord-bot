import { Client, GatewayIntentBits } from 'discord.js'
import { loadCommands } from '@/handlers/commands'
import { loadEvents } from '@/handlers/events'

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
})

client.commands = await loadCommands()

await loadEvents(client)

client.login(import.meta.env.DISCORD_TOKEN)
