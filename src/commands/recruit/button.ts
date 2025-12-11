import type { ButtonInteraction, CacheType } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js'
import { colors } from '@/config'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import {
	CAPACITY,
	createButtons,
	createClosedEmbed,
	createEmbed,
	createFullEmbed,
	createRankedButtons,
	createRankedEmbed,
	createRoleSelectMenu,
	formatRole,
	type LolRole,
	type Participant,
	parseCustomId,
} from './shared'

export const handleButton = async (interaction: ButtonInteraction<CacheType>) => {
	const { action, recruitmentId } = parseCustomId(interaction.customId)

	if (!recruitmentId) {
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
			case 'join':
				await handleJoin(interaction, recruitmentId, existingDescription)
				break
			case 'leave':
				await handleLeave(interaction, recruitmentId, existingDescription)
				break
			case 'force_start':
				await handleForceStart(interaction, recruitmentId, existingDescription)
				break
			case 'close':
				await handleClose(interaction, recruitmentId, existingDescription)
				break
			case 'rank_join':
				await handleRankJoin(interaction, recruitmentId)
				break
			case 'confirm_rank_join':
				await handleConfirmRankJoin(interaction, recruitmentId, existingDescription)
				break
			case 'rank_leave':
				await handleRankLeave(interaction, recruitmentId, existingDescription)
				break
			case 'rank_force':
				await handleRankForce(interaction, recruitmentId, existingDescription)
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

const handleJoin = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
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
		participants: Participant[]
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
	const participantIds = data.participants.map((p) => p.discordId)

	if (data.isFull) {
		const fullEmbed = createFullEmbed(
			participantIds,
			recruitData.recruitment.creatorId,
			recruitData.recruitment.startTime,
			existingDescription,
		)
		await interaction.update({
			embeds: [fullEmbed],
			components: [],
		})

		const mentions = participantIds.map((id) => `<@${id}>`).join(' ')
		await interaction.followUp({
			content: `募集完了! ${mentions}`,
		})
	} else {
		const embed = createEmbed(
			isAnonymous,
			participantIds,
			CAPACITY,
			recruitData.recruitment.creatorId,
			recruitData.recruitment.startTime,
			existingDescription,
		)
		const buttons = createButtons(recruitmentId, false)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

const handleLeave = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
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
		participants: Participant[]
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
	const participantIds = data.participants.map((p) => p.discordId)

	const embed = createEmbed(
		isAnonymous,
		participantIds,
		CAPACITY,
		recruitData.recruitment.creatorId,
		recruitData.recruitment.startTime,
		existingDescription,
	)
	const buttons = createButtons(recruitmentId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

const handleForceStart = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
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
			status: string
		}
		participants: { discordId: string }[]
	}

	// 主催者チェック
	if (recruitData.recruitment.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '強制開始できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 既に終了済みチェック
	if (recruitData.recruitment.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 参加者がいない場合
	if (recruitData.participants.length === 0) {
		await interaction.reply({
			content: '参加者がいないため開始できません。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 募集終了API呼び出し（物理削除）
	const closeResponse = await apiClient.recruit[':id'].$delete({
		param: { id: recruitmentId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '強制開始に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const participants = recruitData.participants.map((p) => p.discordId)

	const fullEmbed = createFullEmbed(
		participants,
		recruitData.recruitment.creatorId,
		recruitData.recruitment.startTime,
		existingDescription,
	)

	await interaction.update({
		embeds: [fullEmbed],
		components: [],
	})

	const mentions = participants.map((id: string) => `<@${id}>`).join(' ')
	await interaction.followUp({
		content: `強制開始! ${mentions}`,
	})
}

const handleClose = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
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
			status: string
		}
		participants: { discordId: string }[]
	}

	// 主催者チェック
	if (recruitData.recruitment.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '募集を終了できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 既に終了済みチェック
	if (recruitData.recruitment.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 募集終了API呼び出し（物理削除）
	const closeResponse = await apiClient.recruit[':id'].$delete({
		param: { id: recruitmentId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '募集の終了に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const isAnonymous = recruitData.recruitment.anonymous === 'true'
	const participants = recruitData.participants.map((p) => p.discordId)

	const closedEmbed = createClosedEmbed(
		isAnonymous,
		participants,
		CAPACITY,
		recruitData.recruitment.creatorId,
		recruitData.recruitment.startTime,
		existingDescription,
	)

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}

const handleRankJoin = async (interaction: ButtonInteraction<CacheType>, recruitmentId: string) => {
	// ランク戦参加 - ロール選択画面を表示
	const mainRoleSelect = createRoleSelectMenu(recruitmentId, 'main')
	const subRoleSelect = createRoleSelectMenu(recruitmentId, 'sub')

	await interaction.reply({
		content: 'ロールを選択してください。\nメインロールとサブロールを選んだ後、「参加確定」ボタンを押してください。',
		components: [
			mainRoleSelect,
			subRoleSelect,
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`recruit:confirm_rank_join:${recruitmentId}`)
					.setLabel('参加確定')
					.setStyle(ButtonStyle.Success),
			),
		],
		flags: MessageFlags.Ephemeral,
	})
}

const handleConfirmRankJoin = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
	// ランク戦参加確定（ロール選択後）
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

		await interaction.update({
			content: message,
			components: [],
		})
		return
	}

	const data = (await response.json()) as {
		success: boolean
		isFull: boolean
		count: number
		participants: Participant[]
	}

	// 募集情報取得
	const recruitResponse = await apiClient.recruit[':id'].$get({
		param: { id: recruitmentId },
	})

	if (!recruitResponse.ok) {
		await interaction.update({
			content: '参加しましたが、募集情報の更新に失敗しました。',
			components: [],
		})
		return
	}

	const recruitData = (await recruitResponse.json()) as {
		recruitment: {
			creatorId: string
			startTime: string | null
		}
	}

	await interaction.update({
		content: '参加しました！',
		components: [],
	})

	// 元のメッセージを更新
	const embed = createRankedEmbed(
		data.participants,
		CAPACITY,
		recruitData.recruitment.creatorId,
		recruitData.recruitment.startTime,
		existingDescription,
	)
	const buttons = createRankedButtons(recruitmentId, false)

	await interaction.message.edit({
		embeds: [embed],
		components: [buttons],
	})

	// 10人揃ったら自動でチーム分け
	if (data.isFull) {
		const mentions = data.participants.map((p) => `<@${p.discordId}>`).join(' ')
		await interaction.followUp({
			content: `🏆 ランク戦募集完了！ ${mentions}\n\n/team balance でチーム分けを行ってください。`,
		})
	}
}

const handleRankLeave = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
	// ランク戦キャンセル
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
		participants: Participant[]
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
			creatorId: string
			startTime: string | null
		}
	}

	const embed = createRankedEmbed(
		data.participants,
		CAPACITY,
		recruitData.recruitment.creatorId,
		recruitData.recruitment.startTime,
		existingDescription,
	)
	const buttons = createRankedButtons(recruitmentId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

const handleRankForce = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
	// ランク戦強制開始
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
			creatorId: string
			startTime: string | null
			status: string
		}
		participants: Participant[]
	}

	// 主催者チェック
	if (recruitData.recruitment.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '強制開始できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.recruitment.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.participants.length === 0) {
		await interaction.reply({
			content: '参加者がいないため開始できません。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 募集終了API呼び出し
	const closeResponse = await apiClient.recruit[':id'].$delete({
		param: { id: recruitmentId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '強制開始に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const embed = new EmbedBuilder()
		.setTitle('🏆 ランク戦開始！')
		.setDescription(existingDescription)
		.setColor(colors.success)

	const participantList = recruitData.participants
		.map((p) => {
			const mainRole = formatRole(p.mainRole as LolRole | null)
			const subRole = formatRole(p.subRole as LolRole | null)
			return `<@${p.discordId}> - メイン: ${mainRole} / サブ: ${subRole}`
		})
		.join('\n')

	embed.addFields({
		name: `参加者 (${recruitData.participants.length}人)`,
		value: participantList,
		inline: false,
	})

	await interaction.update({
		embeds: [embed],
		components: [],
	})

	const mentions = recruitData.participants.map((p) => `<@${p.discordId}>`).join(' ')
	await interaction.followUp({
		content: `🏆 ランク戦強制開始！ ${mentions}\n\n/team balance でチーム分けを行ってください。`,
	})
}
