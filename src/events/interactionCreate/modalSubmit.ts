import type { CacheType, ModalSubmitInteraction } from 'discord.js'
import { logger } from '@/lib/logger'

export const handleModalSubmit = (interaction: ModalSubmitInteraction<CacheType>) => {
	const command = interaction.client.commands.get(interaction.customId)
	if (!command) {
		return
	}
	try {
		if (!command.modal) {
			return
		}
		command.modal(interaction)
	} catch (error) {
		logger.error(error)
	}
}
