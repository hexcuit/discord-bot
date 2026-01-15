import type { AutocompleteInteraction, CacheType } from 'discord.js'

import { logger } from '@/lib/logger'

export const handleAutocomplete = (interaction: AutocompleteInteraction<CacheType>) => {
	const command = interaction.client.commands.get(interaction.commandName)
	if (!command) {
		return
	}
	try {
		if (!command.autocomplete) {
			return
		}
		command.autocomplete(interaction)
	} catch (error) {
		logger.error(error)
	}
}
