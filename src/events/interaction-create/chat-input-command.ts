import type { CacheType, ChatInputCommandInteraction } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleChatInputCommand = async (
	interaction: ChatInputCommandInteraction<CacheType>,
) => {
	const command = interaction.client.commands.get(interaction.commandName)
	if (!command) {
		return
	}

	try {
		await command.execute(interaction)
	} catch (error) {
		logger.error(`Error executing command "${interaction.commandName}":`, error)

		const errorMessage = 'An error occurred while executing the command.'

		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: errorMessage,
					ephemeral: true,
				})
			} else {
				await interaction.reply({
					content: errorMessage,
					ephemeral: true,
				})
			}
		} catch (replyError) {
			logger.error(
				`Failed to send error message for command "${interaction.commandName}":`,
				replyError,
			)
		}
	}
}
