import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import {
	handleClose as handleAnonClose,
	handleForce as handleAnonForce,
	handleJoin as handleAnonJoin,
	handleLeave as handleAnonLeave,
} from './anonymous/button'
import {
	handleClose as handleCreateClose,
	handleForce as handleCreateForce,
	handleJoin as handleCreateJoin,
	handleLeave as handleCreateLeave,
} from './create/button'
import { handleConfirmRankJoin, handleRankForce, handleRankJoin, handleRankLeave } from './rank/button'
import { handleVote, handleVoteDraw } from './rank/vote'
import { parseCustomId } from './shared/utils'

export const handleButton = async (interaction: ButtonInteraction<CacheType>) => {
	const { action, guildId, queueId, originalMessageId } = parseCustomId(interaction.customId)

	// Vote actions use matchId (in guildId position for old format)
	const isVoteAction = action?.startsWith('vote_')

	if (isVoteAction) {
		// Vote actions: guildId contains matchId
		if (!guildId) {
			await interaction.reply({
				content: '無効な操作です。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		try {
			const matchId = guildId
			switch (action) {
				case 'vote_blue':
					await handleVote(interaction, matchId, 'BLUE')
					break
				case 'vote_red':
					await handleVote(interaction, matchId, 'RED')
					break
				case 'vote_draw':
					await handleVoteDraw(interaction, matchId)
					break
			}
		} catch (error) {
			logger.error('投票処理エラー:', error)
			await interaction.reply({
				content: '処理中にエラーが発生しました。',
				flags: MessageFlags.Ephemeral,
			})
		}
		return
	}

	// Queue actions require both guildId and queueId
	if (!guildId || !queueId) {
		await interaction.reply({
			content: '無効な操作です。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	try {
		switch (action) {
			// Create queue
			case 'create_join':
				await handleCreateJoin(interaction, guildId, queueId)
				break
			case 'create_leave':
				await handleCreateLeave(interaction, guildId, queueId)
				break
			case 'create_force':
				await handleCreateForce(interaction, guildId, queueId)
				break
			case 'create_close':
				await handleCreateClose(interaction, guildId, queueId)
				break

			// Anonymous queue
			case 'anon_join':
				await handleAnonJoin(interaction, guildId, queueId)
				break
			case 'anon_leave':
				await handleAnonLeave(interaction, guildId, queueId)
				break
			case 'anon_force':
				await handleAnonForce(interaction, guildId, queueId)
				break
			case 'anon_close':
				await handleAnonClose(interaction, guildId, queueId)
				break

			// Ranked queue
			case 'rank_join':
				await handleRankJoin(interaction, guildId, queueId)
				break
			case 'confirm_rank_join':
				await handleConfirmRankJoin(interaction, guildId, queueId, originalMessageId)
				break
			case 'rank_leave':
				await handleRankLeave(interaction, guildId, queueId)
				break
			case 'rank_force':
				await handleRankForce(interaction, guildId, queueId)
				break
		}
	} catch (error) {
		logger.error('ボタン処理エラー:', error)
		await interaction.reply({
			content: '処理中にエラーが発生しました。',
			flags: MessageFlags.Ephemeral,
		})
	}
}
