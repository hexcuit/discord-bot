import { AttachmentBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'
import { generateStatsCard, type MatchHistoryItem } from '@/utils/stats-card'

type RatingData = {
	discordId: string
	guildId: string
	rating: number | null
	wins: number | null
	losses: number | null
	placementGames: number | null
	isPlacement: boolean | null
	rank: string | null
	rankDetail: {
		tier: string
		division: string | null
		lp: number
	} | null
}

export default {
	command: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('自分またはユーザーのランク戦統計を表示します')
		.setContexts(InteractionContextType.Guild)
		.addUserOption((option) =>
			option.setName('user').setDescription('確認したいユーザー（指定しない場合は自分）').setRequired(false),
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

		const targetUser = interaction.options.getUser('user') ?? interaction.user
		const guildId = interaction.guildId

		try {
			// レーティング取得
			const response = await apiClient.v1.guilds[':guildId'].ratings.$get({
				param: { guildId },
				query: { id: [targetUser.id] },
			})

			if (!response.ok) {
				logger.error('レーティング取得失敗:', response.status)
				await interaction.editReply({
					content: 'ランク情報の取得に失敗しました。',
				})
				return
			}

			const data = (await response.json()) as { ratings: RatingData[] }
			const rating = data.ratings[0]

			if (!rating || rating.rating === null) {
				await interaction.editReply({
					content: `<@${targetUser.id}> はまだランク戦に参加していません。`,
				})
				return
			}

			// ランキング内での順位を取得
			const rankingResponse = await apiClient.v1.guilds[':guildId'].rankings.$get({
				param: { guildId },
				query: { limit: '100' },
			})

			let position: number | null = null
			if (rankingResponse.ok) {
				const rankingData = (await rankingResponse.json()) as {
					rankings: Array<{ discordId: string; position: number }>
				}
				const userRanking = rankingData.rankings.find((r) => r.discordId === targetUser.id)
				position = userRanking?.position ?? null
			}

			// 試合履歴を取得
			let matchHistory: MatchHistoryItem[] = []
			try {
				const historyResponse = await apiClient.v1.guilds[':guildId'].users[':discordId'].$get({
					param: { guildId, discordId: targetUser.id },
					query: { limit: '5' },
				})
				if (historyResponse.ok) {
					const historyData = (await historyResponse.json()) as {
						history: Array<{ won: boolean; change: number }>
					}
					matchHistory = historyData.history.map((h) => ({ won: h.won, change: h.change }))
				}
			} catch {
				// 履歴取得失敗は無視（空配列のまま）
			}

			const wins = rating.wins ?? 0
			const losses = rating.losses ?? 0
			const totalGames = wins + losses
			const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

			// 統計カード画像を生成
			const statsCardBuffer = await generateStatsCard({
				displayName: targetUser.displayName,
				avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 128 }),
				rank: rating.rank ?? 'Unranked',
				rating: rating.rating,
				wins,
				losses,
				winRate,
				position,
				isPlacement: rating.isPlacement ?? false,
				placementGames: rating.placementGames ?? 0,
				matchHistory,
			})

			const attachment = new AttachmentBuilder(statsCardBuffer, { name: 'stats.png' })
			await interaction.editReply({ files: [attachment] })
		} catch (error) {
			logger.error('ランク取得エラー:', error)
			await interaction.editReply({
				content: 'ランク情報の取得中にエラーが発生しました。',
			})
		}
	},
} satisfies Command
