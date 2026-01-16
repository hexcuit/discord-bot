import { SlashCommandBuilder } from 'discord.js'

import type { Command } from '@/types/command'

export default {
	command: new SlashCommandBuilder().setName('help'),
	async execute(interaction) {
		await interaction.reply('Help command executed!')
	},
} satisfies Command
