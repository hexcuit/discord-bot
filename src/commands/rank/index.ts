import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { colors } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'

export default {
	command: new SlashCommandBuilder()
		.setName('rank')
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
		const response = await apiClient.guild.rating.$get({
			query: { guildId, discordIds: [targetUser.id] },
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
		const rankingResponse = await apiClient.guild.ranking.$get({
			query: { guildId, limit: '100' },
		})

		let position: number | null = null
		if (rankingResponse.ok) {
			const rankingData = (await rankingResponse.json()) as {
				rankings: Array<{ discordId: string; position: number }>
			}
			const userRanking = rankingData.rankings.find((r) => r.discordId === targetUser.id)
			position = userRanking?.position ?? null
		}

		const wins = rating.wins ?? 0
		const losses = rating.losses ?? 0
		const totalGames = wins + losses
		const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

		const embed = new EmbedBuilder()
			.setTitle(`🏆 ${targetUser.displayName} のサーバーランク`)
			.setThumbnail(targetUser.displayAvatarURL())
			.setColor(colors.primary)

		if (rating.isPlacement) {
			const placementGames = rating.placementGames ?? 0
			embed.setDescription(`プレイスメント中: ${placementGames}/5 試合`)
			embed.addFields(
				{ name: 'レート', value: `${rating.rating}`, inline: true },
				{ name: '戦績', value: `${wins}勝 ${losses}敗`, inline: true },
				{ name: '勝率', value: `${winRate}%`, inline: true },
			)
		} else {
			embed.addFields(
				{ name: 'ランク', value: rating.rank ?? 'Unknown', inline: true },
				{ name: 'レート', value: `${rating.rating}`, inline: true },
				{ name: '順位', value: position ? `#${position}` : '-', inline: true },
				{ name: '戦績', value: `${wins}勝 ${losses}敗`, inline: true },
				{ name: '勝率', value: `${winRate}%`, inline: true },
			)
		}

		await interaction.editReply({ embeds: [embed] })
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
		const response = await apiClient.guild.ranking.$get({
			query: { guildId, limit: limit.toString() },
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
			.setColor(colors.primary)
			.setFooter({ text: `上位${data.rankings.length}人を表示` })

		await interaction.editReply({ embeds: [embed] })
	} catch (error) {
		logger.error('ランキング取得エラー:', error)
		await interaction.editReply({
			content: 'ランキングの取得中にエラーが発生しました。',
		})
	}
}
