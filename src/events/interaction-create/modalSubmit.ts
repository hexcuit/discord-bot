import type { CacheType, ModalSubmitInteraction } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleModalSubmit = async (interaction: ModalSubmitInteraction<CacheType>) => {
	const command = interaction.client.commands.get(interaction.customId)
	if (!command) {
		return
	}
	try {
		if (!command.modal) {
			return
		}
		await command.modal(interaction)
	} catch (error) {
		logger.error(error)
	}
}
