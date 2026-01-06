import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import type { VoteOption } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import type { TeamAssignments } from '../shared/types'
import { createMatchEmbed, createMatchResultEmbed, createVoteButtons } from './embeds'

export const handleVote = async (
	interaction: ButtonInteraction<CacheType>,
	matchId: string,
	vote: VoteOption,
) => {
	if (!interaction.guildId) {
		await interaction.reply({
			content: 'このコマンドはサーバー内でのみ使用できます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const response = await apiClient.v1.guilds[':guildId'].matches[':matchId'].votes.$post({
		param: { guildId: interaction.guildId, matchId },
		json: {
			discordId: interaction.user.id,
			vote,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message =
			error.message === 'Not a participant'
				? '試合参加者のみ投票できます。'
				: error.message === 'Match is not in voting state'
					? 'この試合は既に終了しています。'
					: '投票に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const data = await response.json()

	// 過半数で確定チェック（2段階確定: 6票で早期確定、全員投票後は最多得票で確定）
	const totalVotes = data.blueVotes + data.redVotes + data.drawVotes
	const hasEarlyMajority =
		data.blueVotes >= data.votesRequired ||
		data.redVotes >= data.votesRequired ||
		data.drawVotes >= data.votesRequired
	const allVotesIn = totalVotes >= data.totalParticipants

	if (hasEarlyMajority || allVotesIn) {
		// 試合確定
		const confirmResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].confirm.$post(
			{
				param: { guildId: interaction.guildId, matchId },
			},
		)

		if (!confirmResponse.ok) {
			logger.error('試合確定失敗:', confirmResponse.status)
			await interaction.reply({
				content: '試合の確定に失敗しました。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const confirmData = await confirmResponse.json()

		// Fetch match data to get player teams
		const matchResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$get({
			param: { guildId: interaction.guildId, matchId },
		})

		if (!matchResponse.ok || !confirmData.winningTeam) {
			await interaction.update({
				content: '試合が確定しました。',
				embeds: [],
				components: [],
			})
			return
		}

		const matchData = await matchResponse.json()
		const playerTeams = new Map(matchData.players.map((p) => [p.discordId, p.team]))

		// Transform ratingChanges to include team and rank info
		const ratingChangesWithTeam = confirmData.ratingChanges.map((r) => ({
			discordId: r.discordId,
			team: playerTeams.get(r.discordId) ?? 'BLUE',
			ratingBefore: r.ratingBefore,
			ratingAfter: r.ratingAfter,
			change: r.ratingChange,
			rank: '', // Rank display not needed for result
		}))

		const resultEmbed = createMatchResultEmbed(confirmData.winningTeam, ratingChangesWithTeam)

		await interaction.update({
			embeds: [resultEmbed],
			components: [],
		})
	} else {
		// 投票状況を更新
		const matchResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$get({
			param: { guildId: interaction.guildId, matchId },
		})

		if (!matchResponse.ok) {
			const voteLabel =
				vote === 'BLUE' ? '🔵 Blue勝利' : vote === 'RED' ? '🔴 Red勝利' : '🤝 引き分け'
			await interaction.reply({
				content: `${voteLabel}に投票しました。`,
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const matchData = await matchResponse.json()

		// Build teamAssignments from players array
		const teamAssignments: TeamAssignments = Object.fromEntries(
			matchData.players.map((player) => [
				player.discordId,
				{
					team: player.team,
					role: player.role,
					rating: player.ratingBefore,
				},
			]),
		)

		// Calculate votesRequired (majority)
		const votesRequired = Math.ceil(matchData.players.length / 2) + 1

		const embed = createMatchEmbed(
			teamAssignments,
			matchData.blueVotes,
			matchData.redVotes,
			matchData.drawVotes,
			votesRequired,
		)
		const buttons = createVoteButtons(matchId)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

export const handleVoteDraw = async (
	interaction: ButtonInteraction<CacheType>,
	matchId: string,
) => {
	// 引き分け投票は通常の投票と同じフローで処理
	await handleVote(interaction, matchId, 'DRAW')
}
