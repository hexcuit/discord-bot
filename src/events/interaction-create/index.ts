import { Events } from 'discord.js'

import type { Event } from '@/types/event'

import { handleAutocomplete } from './autocomplete'
import { handleButton } from './button'
import { handleChatInputCommand } from './chat-input-command'
import { handleModalSubmit } from './modalSubmit'
import { handleSelectMenu } from './selectMenu'

export default {
	name: Events.InteractionCreate,
	once: false,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			await handleChatInputCommand(interaction)
		} else if (interaction.isButton()) {
			await handleButton(interaction)
		} else if (interaction.isAutocomplete()) {
			await handleAutocomplete(interaction)
		} else if (interaction.isModalSubmit()) {
			await handleModalSubmit(interaction)
		} else if (interaction.isStringSelectMenu()) {
			await handleSelectMenu(interaction)
		}
	},
} satisfies Event<Events.InteractionCreate>
