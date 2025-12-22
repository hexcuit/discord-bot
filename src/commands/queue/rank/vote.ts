import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { createMatchEmbed, createMatchResultEmbed, createVoteButtons } from './embeds'
import type { TeamAssignments } from '../shared/types'

export const handleVote = async (interaction: ButtonInteraction<CacheType>, matchId: string, vote: 'blue' | 'red') => {
	if (!interaction.guildId) {
		await interaction.reply({
			content: 'このコマンドはサーバー内でのみ使用できます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 投票API呼び出し（APIは大文字を期待）
	const voteUpperCase = vote.toUpperCase() as 'BLUE' | 'RED'
	const response = await apiClient.v1.guilds[':guildId'].matches[':matchId'].votes.$post({
		param: { guildId: interaction.guildId, matchId },
		json: {
			discordId: interaction.user.id,
			vote: voteUpperCase,
		},
	})

	if (!response.ok) {
		const error = (await response.json()) as { message?: string }
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

	const data = (await response.json()) as {
		changed: boolean
		blueVotes: number
		redVotes: number
		totalParticipants: number
		votesRequired: number
	}

	// 過半数で確定チェック
	if (data.blueVotes >= data.votesRequired || data.redVotes >= data.votesRequired) {
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

		const confirmData = (await confirmResponse.json()) as {
			matchId: string
			winningTeam: 'BLUE' | 'RED'
			ratingChanges: Array<{
				discordId: string
				team: 'BLUE' | 'RED'
				ratingBefore: number
				ratingAfter: number
				change: number
				rank: string
			}>
		}

		// 結果Embed（小文字形式に変換）
		const resultEmbed = createMatchResultEmbed(
			confirmData.winningTeam.toLowerCase() as 'blue' | 'red',
			confirmData.ratingChanges.map((rc) => ({
				...rc,
				team: rc.team.toLowerCase() as 'blue' | 'red',
			})),
		)

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
			await interaction.reply({
				content: `${vote === 'blue' ? '🔵 Blue' : '🔴 Red'}勝利に投票しました。`,
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const matchData = (await matchResponse.json()) as {
			match: {
				teamAssignments: Record<
					string,
					{
						team: 'BLUE' | 'RED'
						role: LolRole
						rating: number
					}
				>
				blueVotes: number
				redVotes: number
			}
			votesRequired: number
		}

		// API形式（大文字）をアプリ形式（小文字）に変換
		const teamAssignmentsLowerCase: TeamAssignments = Object.fromEntries(
			Object.entries(matchData.match.teamAssignments).map(([discordId, assignment]) => [
				discordId,
				{
					team: assignment.team.toLowerCase() as 'blue' | 'red',
					role: assignment.role,
					rating: assignment.rating,
				},
			]),
		)

		const embed = createMatchEmbed(
			teamAssignmentsLowerCase,
			matchData.match.blueVotes,
			matchData.match.redVotes,
			matchData.votesRequired,
		)
		const buttons = createVoteButtons(matchId)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

export const handleVoteCancel = async (interaction: ButtonInteraction<CacheType>, matchId: string) => {
	if (!interaction.guildId) {
		await interaction.reply({
			content: 'このコマンドはサーバー内でのみ使用できます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 試合情報取得
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$get({
		param: { guildId: interaction.guildId, matchId },
	})

	if (!matchResponse.ok) {
		await interaction.reply({
			content: '試合情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const matchData = (await matchResponse.json()) as {
		match: {
			teamAssignments: Record<
				string,
				{
					team: 'BLUE' | 'RED'
					role: LolRole
					rating: number
				}
			>
		}
	}

	// 参加者チェック
	if (!matchData.match.teamAssignments[interaction.user.id]) {
		await interaction.reply({
			content: '試合参加者のみキャンセルできます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 試合キャンセルAPI呼び出し
	const cancelResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$delete({
		param: { guildId: interaction.guildId, matchId },
	})

	if (!cancelResponse.ok) {
		const error = (await cancelResponse.json()) as { message?: string }
		const message =
			error.message === 'Match is not in voting state' ? 'この試合は既に終了しています。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// API形式（大文字）をアプリ形式（小文字）に変換
	const teamAssignmentsLowerCase: TeamAssignments = Object.fromEntries(
		Object.entries(matchData.match.teamAssignments).map(([discordId, assignment]) => [
			discordId,
			{
				team: assignment.team.toLowerCase() as 'blue' | 'red',
				role: assignment.role,
				rating: assignment.rating,
			},
		]),
	)

	const embed = createMatchEmbed(teamAssignmentsLowerCase, 0, 0, 6, 'cancelled')

	await interaction.update({
		embeds: [embed],
		components: [],
	})

	await interaction.followUp({
		content: '試合がキャンセルされました。',
	})
}
