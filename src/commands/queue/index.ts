import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { Command } from '@/types/command'
import { executeAnonymous } from './anonymous/index'
import { handleButton } from './button'
import { executeCreate } from './create/index'
import { executeRank } from './rank/index'

export default {
	command: new SlashCommandBuilder()
		.setName('queue')
		.setDescription('カスタムゲームの募集を作成します')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand((subcommand) =>
			subcommand.setName('create').setDescription('通常募集を作成（参加者名を表示）'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('anonymous')
				.setDescription('匿名募集を作成（参加者名を非表示にし、人数のみ表示）'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('rank')
				.setDescription('ランク戦募集を作成（ロール選択あり、10人で自動チーム分け）'),
		),

	execute: async (interaction) => {
		if (!interaction.guildId) {
			await interaction.reply({
				content: 'このコマンドはサーバー内でのみ使用できます。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const subcommand = interaction.options.getSubcommand()
		const guildId = interaction.guildId

		switch (subcommand) {
			case 'create':
				await executeCreate(interaction, guildId)
				break
			case 'anonymous':
				await executeAnonymous(interaction, guildId)
				break
			case 'rank':
				await executeRank(interaction, guildId)
				break
		}
	},

	button: handleButton,
} satisfies Command
