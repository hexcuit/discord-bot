import type {
	AutocompleteInteraction,
	ButtonInteraction,
	CacheType,
	ChatInputCommandInteraction,
	ModalSubmitInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js'

export interface Command {
	command: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder
	execute: (interaction: ChatInputCommandInteraction<CacheType>) => void | Promise<void>
	autocomplete?: (interaction: AutocompleteInteraction<CacheType>) => void | Promise<void>
	modal?: (interaction: ModalSubmitInteraction<CacheType>) => void | Promise<void>
	button?: (interaction: ButtonInteraction<CacheType>) => void | Promise<void>
}
