import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { COLORS } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'

export default {
	command: new SlashCommandBuilder()
		.setName('ranking')
		.setDescription('サーバー内ランキングを表示します')
		.setContexts(InteractionContextType.Guild)
		.addIntegerOption((option) =>
			option
				.setName('limit')
				.setDescription('表示人数（デフォルト: 10）')
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(25),
		),

	execute: async (interaction) => {
		if (!interaction.guildId) {
			await interaction.reply({
				content: 'このコマンドはサーバー内でのみ使用できます。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		await interaction.deferReply()

		const guildId = interaction.guildId
		const limit = interaction.options.getInteger('limit') ?? 10

		try {
			const response = await apiClient.v1.guilds[':guildId'].rankings.$get({
				param: { guildId },
				query: { limit: limit.toString() },
			})

			if (!response.ok) {
				logger.error('ランキング取得失敗:', response.status)
				await interaction.editReply({
					content: 'ランキングの取得に失敗しました。',
				})
				return
			}

			const data = (await response.json()) as {
				guildId: string
				rankings: Array<{
					position: number
					discordId: string
					rating: number
					wins: number
					losses: number
					winRate: number
					rank: string
				}>
			}

			if (data.rankings.length === 0) {
				await interaction.editReply({
					content: 'まだランキングに登録されているプレイヤーがいません。',
				})
				return
			}

			const getMedal = (pos: number) => {
				switch (pos) {
					case 1:
						return '🥇'
					case 2:
						return '🥈'
					case 3:
						return '🥉'
					default:
						return `${pos}.`
				}
			}

			const rankingLines = data.rankings.map((r) => {
				const medal = getMedal(r.position)
				return `${medal} <@${r.discordId}> - ${r.rank} (${r.rating}) | ${r.wins}W ${r.losses}L (${r.winRate}%)`
			})

			const embed = new EmbedBuilder()
				.setTitle('🏆 サーバーランキング')
				.setDescription(rankingLines.join('\n'))
				.setColor(COLORS.primary)
				.setFooter({ text: `上位${data.rankings.length}人を表示` })

			await interaction.editReply({ embeds: [embed] })
		} catch (error) {
			logger.error('ランキング取得エラー:', error)
			await interaction.editReply({
				content: 'ランキングの取得中にエラーが発生しました。',
			})
		}
	},
} satisfies Command
