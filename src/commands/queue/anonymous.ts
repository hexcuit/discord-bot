import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY, createButtons, createEmbed } from './shared'

export const executeAnonymous = async (interaction: ChatInputCommandInteraction, guildId: string) => {
	const description = interaction.options.getString('description')
	const startTime = interaction.options.getString('start_time')
	const recruitmentId = crypto.randomUUID()

	await interaction.deferReply({ flags: MessageFlags.Ephemeral })

	if (!interaction.channel || !interaction.channel.isSendable()) {
		await interaction.editReply({ content: 'チャンネル情報を取得できませんでした。' })
		return
	}

	const embed = createEmbed(true, [], CAPACITY, interaction.user.id, startTime, description)
	const disabledButtons = createButtons(recruitmentId, true)

	const message = await interaction.channel.send({
		embeds: [embed],
		components: [disabledButtons],
	})

	try {
		const response = await apiClient.v1.queues.$post({
			json: {
				id: recruitmentId,
				guildId,
				channelId: interaction.channelId,
				messageId: message.id,
				creatorId: interaction.user.id,
				anonymous: true,
				startTime: startTime || undefined,
			},
		})

		if (!response.ok) {
			logger.error('募集作成失敗:', response.status)
			await message.delete()
			await interaction.editReply({ content: '募集の作成に失敗しました。' })
			return
		}

		const enabledButtons = createButtons(recruitmentId, false)
		await message.edit({
			embeds: [embed],
			components: [enabledButtons],
		})

		await interaction.editReply({ content: '匿名募集を作成しました！' })
	} catch (error) {
		logger.error('募集作成エラー:', error)
		await message.delete().catch(() => {})
		await interaction.editReply({ content: '募集の作成に失敗しました。' })
	}
}
