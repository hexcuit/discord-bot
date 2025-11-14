import { Events } from 'discord.js'
import type { Event } from '@/types/event'
import { handleAutocomplete } from './autocomplete'
import { handleButton } from './button'
import { handleChatInputCommand } from './chatInputCommand'
import { handleModalSubmit } from './modalSubmit'

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
		}
	},
} satisfies Event<Events.InteractionCreate>
