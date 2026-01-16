import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'

import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'

import { CAPACITY } from '../shared/constants'
import { createButtons, createEmbed } from './embeds'

export const executeAnonymous = async (
	interaction: ChatInputCommandInteraction,
	guildId: string,
) => {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })

	if (!interaction.channel || !interaction.channel.isSendable()) {
		await interaction.editReply({ content: 'チャンネル情報を取得できませんでした。' })
		return
	}

	const embed = createEmbed(0, CAPACITY, interaction.user.id)
	const message = await interaction.channel.send({ embeds: [embed] })

	try {
		const response = await apiClient.v1.guilds[':guildId'].queues.$post({
			param: { guildId },
			json: {
				channelId: interaction.channelId,
				messageId: message.id,
				creatorId: interaction.user.id,
				type: 'normal',
				anonymous: true,
				capacity: CAPACITY,
			},
		})

		if (!response.ok) {
			logger.error('募集作成失敗:', response.status)
			await message.delete()
			await interaction.editReply({ content: '募集の作成に失敗しました。' })
			return
		}

		const queueData = await response.json()
		const buttons = createButtons(guildId, queueData.id, false)
		await message.edit({ embeds: [embed], components: [buttons] })

		await interaction.editReply({ content: '匿名募集を作成しました！' })
	} catch (error) {
		logger.error('募集作成エラー:', error)
		await message.delete().catch(() => {})
		await interaction.editReply({ content: '募集の作成に失敗しました。' })
	}
}
