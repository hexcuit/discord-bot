import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY } from '../shared/constants'
import { createRankedButtons, createRankedEmbed } from './embeds'

export const executeRank = async (interaction: ChatInputCommandInteraction, guildId: string) => {
	const description = interaction.options.getString('description')
	const startTime = interaction.options.getString('start_time')
	const queueId = crypto.randomUUID()

	// Defer as ephemeral so success/error messages are only visible to the user
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })

	if (!interaction.channel || !interaction.channel.isSendable()) {
		await interaction.editReply({ content: 'チャンネル情報を取得できませんでした。' })
		return
	}

	const embed = createRankedEmbed([], CAPACITY, interaction.user.id, startTime, description)
	const disabledButtons = createRankedButtons(queueId, true)

	// Send the recruitment message publicly via channel.send (not interaction.reply)
	const message = await interaction.channel.send({
		embeds: [embed],
		components: [disabledButtons],
	})

	try {
		const response = await apiClient.v1.queues.$post({
			json: {
				id: queueId,
				guildId,
				channelId: interaction.channelId,
				messageId: message.id,
				creatorId: interaction.user.id,
				type: 'ranked',
				anonymous: false,
				startTime: startTime || undefined,
			},
		})

		if (!response.ok) {
			logger.error('ランク戦募集作成失敗:', response.status)
			await message.delete()
			await interaction.editReply({ content: 'ランク戦募集の作成に失敗しました。' })
			return
		}

		const enabledButtons = createRankedButtons(queueId, false)
		await message.edit({
			embeds: [embed],
			components: [enabledButtons],
		})

		await interaction.editReply({ content: 'ランク戦募集を作成しました！' })
	} catch (error) {
		logger.error('ランク戦募集作成エラー:', error)
		// Ignore deletion failure - message may already be deleted
		await message.delete().catch(() => {})
		await interaction.editReply({ content: 'ランク戦募集の作成に失敗しました。' })
	}
}
