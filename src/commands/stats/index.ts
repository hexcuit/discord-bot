import {
	AttachmentBuilder,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} from 'discord.js'

import type { Command } from '@/types/command'

import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'

export default {
	command: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('自分またはユーザーのランク戦統計を表示します')
		.setContexts(InteractionContextType.Guild)
		.addUserOption((option) =>
			option
				.setName('user')
				.setDescription('確認したいユーザー（指定しない場合は自分）')
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!interaction.guildId) {
			await interaction.reply({
				content: 'このコマンドはサーバー内でのみ使用できます。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		await interaction.deferReply()

		const targetUser = interaction.options.getUser('user') ?? interaction.user
		const guildId = interaction.guildId

		try {
			// 統計画像を取得（サーバー側で生成）
			const imageResponse = await apiClient.v1.guilds[':guildId'].users[
				':discordId'
			].stats.image.$get({
				param: { guildId, discordId: targetUser.id },
				query: {
					displayName: targetUser.displayName,
					avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 128 }),
				},
			})

			if (!imageResponse.ok) {
				// 統計が見つからない場合
				if (imageResponse.status === 404) {
					await interaction.editReply({
						content: `<@${targetUser.id}> はまだランク戦に参加していません。`,
					})
					return
				}

				logger.error('統計画像取得失敗:', imageResponse.status)
				await interaction.editReply({
					content: 'ランク情報の取得に失敗しました。',
				})
				return
			}

			// 画像データをバッファとして取得
			const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats.png' })

			await interaction.editReply({ files: [attachment] })
		} catch (error) {
			logger.error('ランク取得エラー:', error)
			await interaction.editReply({
				content: 'ランク情報の取得中にエラーが発生しました。',
			})
		}
	},
} satisfies Command
