import type { AutocompleteInteraction, CacheType } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleAutocomplete = async (interaction: AutocompleteInteraction<CacheType>) => {
	const command = interaction.client.commands.get(interaction.commandName)
	if (!command) {
		return
	}
	try {
		if (!command.autocomplete) {
			return
		}
		await command.autocomplete(interaction)
	} catch (error) {
		logger.error(error)
	}
}
