import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import type { VoteOption } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import type { TeamAssignments } from '../shared/types'
import { createMatchEmbed, createMatchResultEmbed, createVoteButtons } from './embeds'

export const handleVote = async (interaction: ButtonInteraction<CacheType>, matchId: string, vote: VoteOption) => {
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
		data.blueVotes >= data.votesRequired || data.redVotes >= data.votesRequired || data.drawVotes >= data.votesRequired
	const allVotesIn = totalVotes >= data.totalParticipants

	if (hasEarlyMajority || allVotesIn) {
		// 試合確定
		const confirmResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].confirm.$post({
			param: { guildId: interaction.guildId, matchId },
		})

		if (!confirmResponse.ok) {
			logger.error('試合確定失敗:', confirmResponse.status)
			await interaction.reply({
				content: '試合の確定に失敗しました。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const confirmData = await confirmResponse.json()

		const resultEmbed = createMatchResultEmbed(confirmData.winningTeam, confirmData.ratingChanges)

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
			const voteLabel = vote === 'BLUE' ? '🔵 Blue勝利' : vote === 'RED' ? '🔴 Red勝利' : '🤝 引き分け'
			await interaction.reply({
				content: `${voteLabel}に投票しました。`,
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const matchData = await matchResponse.json()

		const teamAssignments: TeamAssignments = Object.fromEntries(
			Object.entries(matchData.match.teamAssignments).map(([discordId, assignment]) => [
				discordId,
				{
					team: assignment.team,
					role: assignment.role,
					rating: assignment.rating,
				},
			]),
		)

		const embed = createMatchEmbed(
			teamAssignments,
			matchData.match.blueVotes,
			matchData.match.redVotes,
			matchData.match.drawVotes,
			matchData.votesRequired,
		)
		const buttons = createVoteButtons(matchId)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

export const handleVoteDraw = async (interaction: ButtonInteraction<CacheType>, matchId: string) => {
	// 引き分け投票は通常の投票と同じフローで処理
	await handleVote(interaction, matchId, 'DRAW')
}
