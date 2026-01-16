import { SlashCommandBuilder } from 'discord.js'

import type { Command } from '@/types/command'

import { executeBalance } from './balance'
import { executeRandom } from './random'

export default {
	command: new SlashCommandBuilder()
		.setName('team')
		.setDescription('チーム分けを行います')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('balance')
				.setDescription('ランクによる実力差を考慮したチーム分けを行います')
				.addStringOption((option) =>
					option
						.setName('exclude')
						.setDescription(
							'チーム分けから除外するユーザーを @メンションまたはIDでスペース区切り指定',
						)
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('random')
				.setDescription('完全ランダムでチーム分けを行います')
				.addStringOption((option) =>
					option
						.setName('exclude')
						.setDescription(
							'チーム分けから除外するユーザーを @メンションまたはIDでスペース区切り指定',
						)
						.setRequired(false),
				),
		),

	execute: async (interaction) => {
		const subcommand = interaction.options.getSubcommand()

		switch (subcommand) {
			case 'balance':
				await executeBalance(interaction)
				break
			case 'random':
				await executeRandom(interaction)
				break
		}
	},
} satisfies Command
