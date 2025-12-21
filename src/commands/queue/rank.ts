import type { ChatInputCommandInteraction } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY, createRankedButtons, createRankedEmbed } from './shared'

export const executeRank = async (interaction: ChatInputCommandInteraction, guildId: string) => {
	const description = interaction.options.getString('description')
	const startTime = interaction.options.getString('start_time')
	const recruitmentId = crypto.randomUUID()

	const embed = createRankedEmbed([], CAPACITY, interaction.user.id, startTime, description)
	const disabledButtons = createRankedButtons(recruitmentId, true)

	await interaction.reply({
		embeds: [embed],
		components: [disabledButtons],
	})

	const reply = await interaction.fetchReply()

	try {
		const response = await apiClient.v1.queues.$post({
			json: {
				id: recruitmentId,
				guildId,
				channelId: interaction.channelId,
				messageId: reply.id,
				creatorId: interaction.user.id,
				type: 'ranked',
				anonymous: false,
				startTime: startTime || undefined,
			},
		})

		if (!response.ok) {
			logger.error('ランク戦募集作成失敗:', response.status)
			await interaction.editReply({
				content: 'ランク戦募集の作成に失敗しました。',
				embeds: [],
				components: [],
			})
			return
		}

		const enabledButtons = createRankedButtons(recruitmentId, false)
		await interaction.editReply({
			embeds: [embed],
			components: [enabledButtons],
		})
	} catch (error) {
		logger.error('ランク戦募集作成エラー:', error)
		await interaction.editReply({
			content: 'ランク戦募集の作成に失敗しました。',
			embeds: [],
			components: [],
		})
	}
}
