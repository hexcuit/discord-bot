import { SlashCommandBuilder } from 'discord.js'
import type { Command } from '@/types/command'

export default {
	command: new SlashCommandBuilder().setName('help'),
	execute(interaction) {
		interaction.reply('Help command executed!')
	},
} satisfies Command
