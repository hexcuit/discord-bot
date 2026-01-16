import type { CacheType, StringSelectMenuInteraction } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleSelectMenu = async (interaction: StringSelectMenuInteraction<CacheType>) => {
	const [commandName] = interaction.customId.split(':')
	if (!commandName) {
		return
	}
	const command = interaction.client.commands.get(commandName)
	if (!command) {
		return
	}
	try {
		if (!command.selectMenu) {
			return
		}
		await command.selectMenu(interaction)
	} catch (error) {
		logger.error(error)
	}
}
