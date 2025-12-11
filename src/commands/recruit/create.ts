import type { ChatInputCommandInteraction } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY, createButtons, createEmbed } from './shared'

export const executeCreate = async (interaction: ChatInputCommandInteraction, guildId: string) => {
	const description = interaction.options.getString('description')
	const startTime = interaction.options.getString('start_time')
	const recruitmentId = crypto.randomUUID()

	const embed = createEmbed(false, [], CAPACITY, interaction.user.id, startTime, description)
	const disabledButtons = createButtons(recruitmentId, true)

	await interaction.reply({
		embeds: [embed],
		components: [disabledButtons],
	})

	const reply = await interaction.fetchReply()

	try {
		const response = await apiClient.recruit.$post({
			json: {
				id: recruitmentId,
				guildId,
				channelId: interaction.channelId,
				messageId: reply.id,
				creatorId: interaction.user.id,
				anonymous: false,
				startTime: startTime || undefined,
			},
		})

		if (!response.ok) {
			logger.error('募集作成失敗:', response.status)
			await interaction.editReply({
				content: '募集の作成に失敗しました。',
				embeds: [],
				components: [],
			})
			return
		}

		const enabledButtons = createButtons(recruitmentId, false)
		await interaction.editReply({
			embeds: [embed],
			components: [enabledButtons],
		})
	} catch (error) {
		logger.error('募集作成エラー:', error)
		await interaction.editReply({
			content: '募集の作成に失敗しました。',
			embeds: [],
			components: [],
		})
	}
}
