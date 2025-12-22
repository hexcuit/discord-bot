import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import { handleConfirmRankJoin, handleRankForce, handleRankJoin, handleRankLeave } from './rank/buttons'
import { handleVote, handleVoteCancel } from './rank/vote'
import { handleClose, handleForceStart, handleJoin, handleLeave } from './shared/buttons'
import { parseCustomId } from './shared/utils'

export const handleButton = async (interaction: ButtonInteraction<CacheType>) => {
	const { action, queueId, originalMessageId } = parseCustomId(interaction.customId)

	if (!queueId) {
		await interaction.reply({
			content: '無効な操作です。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 既存のEmbedからdescriptionを取得して維持
	const existingEmbed = interaction.message.embeds[0]
	const existingDescription = existingEmbed?.description ?? null

	try {
		switch (action) {
			// Normal queue (create/anonymous)
			case 'join':
				await handleJoin(interaction, queueId, existingDescription)
				break
			case 'leave':
				await handleLeave(interaction, queueId, existingDescription)
				break
			case 'force_start':
				await handleForceStart(interaction, queueId, existingDescription)
				break
			case 'close':
				await handleClose(interaction, queueId, existingDescription)
				break

			// Ranked queue
			case 'rank_join':
				await handleRankJoin(interaction, queueId)
				break
			case 'confirm_rank_join':
				await handleConfirmRankJoin(interaction, queueId, originalMessageId)
				break
			case 'rank_leave':
				await handleRankLeave(interaction, queueId, existingDescription)
				break
			case 'rank_force':
				await handleRankForce(interaction, queueId, existingDescription)
				break

			// Vote
			case 'vote_blue':
				await handleVote(interaction, queueId, 'BLUE')
				break
			case 'vote_red':
				await handleVote(interaction, queueId, 'RED')
				break
			case 'vote_cancel':
				await handleVoteCancel(interaction, queueId)
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
