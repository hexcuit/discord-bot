import { REST, Routes } from 'discord.js'
import { loadCommands } from '@/handlers/commands'
import { logger } from '@/lib/logger'

interface DeploymentConfig {
	scope: 'global' | 'guild'
	route: `/${string}`
}

const getDeploymentConfig = (): DeploymentConfig => {
	const isDev = import.meta.env.NODE_ENV === 'development'

	if (!isDev || !import.meta.env.DISCORD_GUILD_ID) {
		return {
			scope: 'global',
			route: Routes.applicationCommands(import.meta.env.DISCORD_CLIENT_ID),
		}
	}

	return {
		scope: 'guild',
		route: Routes.applicationGuildCommands(import.meta.env.DISCORD_CLIENT_ID, import.meta.env.DISCORD_GUILD_ID),
	}
}

const deployCommands = async (): Promise<void> => {
	const collection = await loadCommands()

	const commands = collection.map((cmd) => cmd.command.toJSON())

	if (commands.length === 0) {
		logger.warn('No commands to deploy')
		return
	}

	const config = getDeploymentConfig()

	logger.info(`Deploying ${commands.length} commands to ${config.scope} scope`)

	try {
		const rest = new REST({ version: '10' }).setToken(import.meta.env.DISCORD_TOKEN)
		await rest.put(config.route, { body: commands })

		logger.info(`Successfully deployed ${commands.length} commands to ${config.scope} scope`)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error(`Command deployment failed: ${errorMessage}`)
		throw error
	}
}

await deployCommands()
