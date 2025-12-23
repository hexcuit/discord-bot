import { AttachmentBuilder, EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { COLORS } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'
import { generateStatsCard, type MatchHistoryItem } from '@/utils/stats-card'

export default {
	command: new SlashCommandBuilder()
		.setName('ranking')
		.setDescription('サーバー内ランク情報を表示します')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('server')
				.setDescription('サーバー内ランクを表示')
				.addUserOption((option) =>
					option.setName('user').setDescription('確認したいユーザー（指定しない場合は自分）').setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('leaderboard')
				.setDescription('サーバー内ランキングを表示')
				.addIntegerOption((option) =>
					option
						.setName('limit')
						.setDescription('表示人数（デフォルト: 10）')
						.setRequired(false)
						.setMinValue(1)
						.setMaxValue(25),
				),
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

		switch (subcommand) {
			case 'server':
				await executeServer(interaction)
				break
			case 'leaderboard':
				await executeLeaderboard(interaction)
				break
		}
	},
} satisfies Command

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

const executeServer = async (interaction: Parameters<Command['execute']>[0]) => {
	await interaction.deferReply()

	const targetUser = interaction.options.getUser('user') ?? interaction.user
	const guildId = interaction.guildId as string

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
}

const executeLeaderboard = async (interaction: Parameters<Command['execute']>[0]) => {
	await interaction.deferReply()

	const guildId = interaction.guildId as string
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
}
