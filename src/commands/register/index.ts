import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js'

import type { LolDivision, LolTier } from '@/constants'
import type { Command } from '@/types/command'

import { COLORS, RANK_EMOJI } from '@/config'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'

export default {
	command: new SlashCommandBuilder()
		.setName('register')
		.setDescription('ランクとDiscordアカウントを紐付けます')
		.addStringOption((option) =>
			option
				.setName('tier')
				.setDescription('ティアを登録します')
				.addChoices(
					{ name: 'アイアン', value: 'IRON' },
					{ name: 'ブロンズ', value: 'BRONZE' },
					{ name: 'シルバー', value: 'SILVER' },
					{ name: 'ゴールド', value: 'GOLD' },
					{ name: 'プラチナ', value: 'PLATINUM' },
					{ name: 'エメラルド', value: 'EMERALD' },
					{ name: 'ダイヤモンド', value: 'DIAMOND' },
					{ name: 'マスター', value: 'MASTER' },
					{ name: 'グランドマスター', value: 'GRANDMASTER' },
					{ name: 'チャレンジャー', value: 'CHALLENGER' },
				)
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('division')
				.setDescription('ディビジョンを登録します')
				.addChoices(
					{ name: 'IV', value: 'IV' },
					{ name: 'III', value: 'III' },
					{ name: 'II', value: 'II' },
					{ name: 'I', value: 'I' },
					{ name: 'なし', value: 'NONE' },
				)
				.setRequired(true),
		),

	execute: async (interaction) => {
		try {
			// オプションの取得
			const tier = interaction.options.getString('tier', true) as LolTier
			// ディビジョンはアンランク,マスター,グランドマスター,チャレンジャーの場合は空文字にする
			const division = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)
				? null
				: interaction.options.getString('division', true) === 'NONE'
					? null
					: (interaction.options.getString('division', true) as LolDivision)

			// APIリクエスト

			// 元のランクを取得
			const currentUserResponse = await apiClient.v1.users[':discordId'].$get({
				param: { discordId: interaction.user.id },
			})

			// ユーザーが存在しない場合は null
			const currentRank = currentUserResponse.ok ? (await currentUserResponse.json()).rank : null

			// ランクを登録/更新
			const updateResponse = await apiClient.v1.users[':discordId'].rank.$put({
				param: { discordId: interaction.user.id },
				json: {
					tier,
					division,
				},
			})

			if (!updateResponse.ok) {
				logger.error('APIリクエスト失敗:', updateResponse.status, updateResponse.statusText)
				await interaction.reply({
					content: '登録中にエラーが発生しました。後でもう一度お試しください。',
					flags: MessageFlags.Ephemeral,
				})
				return
			}

			const newEmoji = RANK_EMOJI[tier] || ''
			const embedMessage = new EmbedBuilder()
				.setTitle('ランク登録完了')
				.setColor(COLORS.success)
				.setThumbnail(interaction.user.displayAvatarURL())

			if (currentRank) {
				// 更新: Old → New を表示
				const oldEmoji = RANK_EMOJI[currentRank.tier] || ''
				embedMessage.addFields(
					{
						name: 'Old Rank',
						value: `${oldEmoji} ${currentRank.tier} ${currentRank.division ?? ''}`.trim(),
						inline: true,
					},
					{
						name: '\u200B',
						value: '➤',
						inline: true,
					},
					{
						name: 'New Rank',
						value: `${newEmoji} ${tier} ${division ?? ''}`.trim(),
						inline: true,
					},
				)
			} else {
				// 新規登録
				embedMessage.addFields({
					name: 'Rank',
					value: `${newEmoji} ${tier} ${division ?? ''}`.trim(),
				})
			}

			await interaction.reply({
				embeds: [embedMessage],
			})
		} catch (error) {
			logger.error('コマンド実行中にエラーが発生:', error)
			await interaction.reply({
				content: '予期しないエラーが発生しました。後でもう一度お試しください。',
				flags: MessageFlags.Ephemeral,
			})
		}
	},
} satisfies Command
