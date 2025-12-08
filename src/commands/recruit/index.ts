import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} from 'discord.js'
import { colors } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'

const CAPACITY = 10

const parseCustomId = (customId: string) => {
	const parts = customId.split(':')
	return {
		command: parts[0],
		action: parts[1],
		recruitmentId: parts[2],
	}
}

const createEmbed = (
	anonymous: boolean,
	participants: string[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
) => {
	const embed = new EmbedBuilder().setTitle('カスタム募集').setColor(colors.success)

	if (startTime) {
		embed.addFields({
			name: '開始時間',
			value: startTime,
			inline: true,
		})
	}

	if (anonymous) {
		embed.addFields({
			name: '参加者',
			value: `${participants.length}/${capacity}人`,
			inline: false,
		})
	} else {
		const participantList = participants.length > 0 ? participants.map((id) => `<@${id}>`).join('\n') : 'なし'

		embed.addFields({
			name: `参加者 (${participants.length}/${capacity})`,
			value: participantList,
			inline: false,
		})
	}

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

const createButtons = (recruitmentId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:join:${recruitmentId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:leave:${recruitmentId}`)
			.setLabel('キャンセル')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
	)
}

const createFullEmbed = (participants: string[], creatorId: string, startTime?: string | null) => {
	const embed = new EmbedBuilder().setTitle('募集完了!').setDescription('定員に達しました!').setColor(colors.success)

	if (startTime) {
		embed.addFields({
			name: '開始時間',
			value: startTime,
			inline: true,
		})
	}

	const mentions = participants.map((id) => `<@${id}>`).join('\n')
	embed.addFields({
		name: `参加者 (${participants.length}/${CAPACITY})`,
		value: mentions,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

export default {
	command: new SlashCommandBuilder()
		.setName('recruit')
		.setDescription('カスタムゲームの募集を作成します（定員10人）')
		.setContexts(InteractionContextType.Guild)
		.addBooleanOption((option) =>
			option.setName('anonymous').setDescription('匿名モード（参加者名を非表示にし、人数のみ表示）').setRequired(false),
		)
		.addStringOption((option) =>
			option.setName('start_time').setDescription('開始時間（例: 21:00）').setRequired(false),
		),

	execute: async (interaction) => {
		const anonymous = interaction.options.getBoolean('anonymous') ?? false
		const startTime = interaction.options.getString('start_time')
		const recruitmentId = crypto.randomUUID()

		const embed = createEmbed(anonymous, [], CAPACITY, interaction.user.id, startTime)
		const disabledButtons = createButtons(recruitmentId, true)

		// 最初はボタンを無効化して送信（API完了前のクリックを防止）
		await interaction.reply({
			embeds: [embed],
			components: [disabledButtons],
		})

		const reply = await interaction.fetchReply()

		try {
			const response = await apiClient.recruit.$post({
				json: {
					id: recruitmentId,
					guildId: interaction.guildId!,
					channelId: interaction.channelId,
					messageId: reply.id,
					creatorId: interaction.user.id,
					anonymous,
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

			// API成功後にボタンを有効化
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
	},

	button: async (interaction) => {
		const { action, recruitmentId } = parseCustomId(interaction.customId)

		if (!recruitmentId) {
			await interaction.reply({
				content: '無効な操作です。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		try {
			if (action === 'join') {
				const response = await apiClient.recruit.join.$post({
					json: {
						recruitmentId,
						discordId: interaction.user.id,
					},
				})

				if (!response.ok) {
					const error = (await response.json()) as { error?: string }
					const message =
						error.error === 'Already joined'
							? '既に参加しています。'
							: error.error === 'Recruitment is full'
								? '定員に達しています。'
								: error.error === 'Recruitment is not open'
									? '募集は終了しています。'
									: '参加に失敗しました。'

					await interaction.reply({
						content: message,
						flags: MessageFlags.Ephemeral,
					})
					return
				}

				const data = (await response.json()) as {
					success: boolean
					isFull: boolean
					count: number
					participants: string[]
				}

				// 募集情報取得
				const recruitResponse = await apiClient.recruit[':id'].$get({
					param: { id: recruitmentId },
				})

				if (!recruitResponse.ok) {
					logger.error('募集情報取得失敗:', recruitResponse.status)
					await interaction.reply({
						content: '募集情報の取得に失敗しました。',
						flags: MessageFlags.Ephemeral,
					})
					return
				}

				const recruitData = (await recruitResponse.json()) as {
					recruitment: {
						anonymous: string
						creatorId: string
						startTime: string | null
					}
				}

				const isAnonymous = recruitData.recruitment.anonymous === 'true'

				if (data.isFull) {
					const fullEmbed = createFullEmbed(
						data.participants,
						recruitData.recruitment.creatorId,
						recruitData.recruitment.startTime,
					)
					await interaction.update({
						embeds: [fullEmbed],
						components: [],
					})

					const mentions = data.participants.map((id: string) => `<@${id}>`).join(' ')
					await interaction.followUp({
						content: `募集完了! ${mentions}`,
					})
				} else {
					const embed = createEmbed(
						isAnonymous,
						data.participants,
						CAPACITY,
						recruitData.recruitment.creatorId,
						recruitData.recruitment.startTime,
					)
					const buttons = createButtons(recruitmentId, false)

					await interaction.update({
						embeds: [embed],
						components: [buttons],
					})
				}
			} else if (action === 'leave') {
				const response = await apiClient.recruit.leave.$post({
					json: {
						recruitmentId,
						discordId: interaction.user.id,
					},
				})

				if (!response.ok) {
					const error = (await response.json()) as { error?: string }
					const message = error.error === 'Not joined' ? '参加していません。' : 'キャンセルに失敗しました。'

					await interaction.reply({
						content: message,
						flags: MessageFlags.Ephemeral,
					})
					return
				}

				const data = (await response.json()) as {
					success: boolean
					count: number
					participants: string[]
				}

				const recruitResponse = await apiClient.recruit[':id'].$get({
					param: { id: recruitmentId },
				})

				if (!recruitResponse.ok) {
					logger.error('募集情報取得失敗:', recruitResponse.status)
					await interaction.reply({
						content: '募集情報の取得に失敗しました。',
						flags: MessageFlags.Ephemeral,
					})
					return
				}

				const recruitData = (await recruitResponse.json()) as {
					recruitment: {
						anonymous: string
						creatorId: string
						startTime: string | null
					}
				}

				const isAnonymous = recruitData.recruitment.anonymous === 'true'

				const embed = createEmbed(
					isAnonymous,
					data.participants,
					CAPACITY,
					recruitData.recruitment.creatorId,
					recruitData.recruitment.startTime,
				)
				const buttons = createButtons(recruitmentId, false)

				await interaction.update({
					embeds: [embed],
					components: [buttons],
				})
			}
		} catch (error) {
			logger.error('ボタン処理エラー:', error)
			await interaction.reply({
				content: '処理中にエラーが発生しました。',
				flags: MessageFlags.Ephemeral,
			})
		}
	},
} satisfies Command
