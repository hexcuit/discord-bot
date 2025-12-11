import { Events } from 'discord.js'
import type { Event } from '@/types/event'
import { handleAutocomplete } from './autocomplete'
import { handleButton } from './button'
import { handleChatInputCommand } from './chatInput-command'
import { handleModalSubmit } from './modalSubmit'
import { handleSelectMenu } from './selectMenu'

export default {
	name: Events.InteractionCreate,
	once: false,
	execute(interaction) {
		// 受け取ったインタラクションの種類に応じてハンドラを呼び出す
		if (interaction.isChatInputCommand()) {
			handleChatInputCommand(interaction)
		} else if (interaction.isButton()) {
			handleButton(interaction)
		} else if (interaction.isAutocomplete()) {
			handleAutocomplete(interaction)
		} else if (interaction.isModalSubmit()) {
			handleModalSubmit(interaction)
		} else if (interaction.isStringSelectMenu()) {
			handleSelectMenu(interaction)
		}
	},
} satisfies Event<Events.InteractionCreate>
