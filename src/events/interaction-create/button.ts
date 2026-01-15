import type { ButtonInteraction, CacheType } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleButton = (interaction: ButtonInteraction<CacheType>) => {
	const [commandName] = interaction.customId.split(':')
	if (!commandName) {
		return
	}
	const command = interaction.client.commands.get(commandName)
	if (!command) {
		return
	}
	try {
		if (!command.button) {
			return
		}
		command.button(interaction)
	} catch (error) {
		logger.error(error)
	}
}
