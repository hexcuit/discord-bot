import type { ButtonInteraction, CacheType } from 'discord.js'

import { MessageFlags } from 'discord.js'

import type { VoteOption } from '@/constants'

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

	// Call vote endpoint - server auto-confirms when majority reached
	const response = await apiClient.v1.guilds[':guildId'].matches[':matchId'].vote.$post({
		param: { guildId: interaction.guildId, matchId },
		json: {
			discordId: interaction.user.id,
			vote,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message =
			error.message === 'Player not in match'
				? '試合参加者のみ投票できます。'
				: error.message === 'Match already confirmed'
					? 'この試合は既に終了しています。'
					: '投票に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const data = await response.json()

	if (data.status === 'confirmed') {
		// Match was confirmed - show result
		const { winningTeam, ratingChanges } = data

		const ratingChangesWithTeam = ratingChanges.map((r) => ({
			discordId: r.discordId,
			team: r.team,
			ratingBefore: r.ratingBefore,
			ratingAfter: r.ratingAfter,
			change: r.ratingChange,
			rank: '',
		}))

		const resultEmbed = createMatchResultEmbed(winningTeam, ratingChangesWithTeam)

		await interaction.update({
			embeds: [resultEmbed],
			components: [],
		})
	} else {
		// Still voting - update vote counts
		const { votes } = data

		// We need to reconstruct teamAssignments for the embed
		// Since we don't have GET endpoint, we'll show simplified update
		const voteLabel =
			vote === 'BLUE' ? '🔵 Blue勝利' : vote === 'RED' ? '🔴 Red勝利' : '🤝 引き分け'

		// Try to get current embed and update it
		const currentEmbed = interaction.message.embeds[0]
		if (currentEmbed) {
			// Parse team assignments from current embed fields
			const teamAssignments: TeamAssignments = {}

			for (const field of currentEmbed.fields) {
				if (field.name === '🔵 Blue Team' || field.name === '🔴 Red Team') {
					const team = field.name.includes('Blue') ? 'BLUE' : 'RED'
					const lines = field.value.split('\n')
					for (const line of lines) {
						// Format: "<@discordId> - ROLE (rating)"
						const match = line.match(/<@(\d+)>\s*-\s*(\w+)\s*\((\d+)\)/)
						if (match) {
							const [, discordId, role, rating] = match
							if (discordId && role && rating) {
								teamAssignments[discordId] = {
									team: team as 'BLUE' | 'RED',
									role: role as TeamAssignments[string]['role'],
									rating: Number.parseInt(rating, 10),
								}
							}
						}
					}
				}
			}

			if (Object.keys(teamAssignments).length > 0) {
				const embed = createMatchEmbed(
					teamAssignments,
					votes.blueVotes,
					votes.redVotes,
					votes.drawVotes,
					votes.votesRequired,
				)
				const buttons = createVoteButtons(matchId)

				await interaction.update({
					embeds: [embed],
					components: [buttons],
				})
				return
			}
		}

		// Fallback: just show vote confirmation
		await interaction.reply({
			content: `${voteLabel}に投票しました。(Blue: ${votes.blueVotes}, Red: ${votes.redVotes}, Draw: ${votes.drawVotes})`,
			flags: MessageFlags.Ephemeral,
		})
	}
}

export const handleVoteDraw = async (
	interaction: ButtonInteraction<CacheType>,
	matchId: string,
) => {
	await handleVote(interaction, matchId, 'DRAW')
}
