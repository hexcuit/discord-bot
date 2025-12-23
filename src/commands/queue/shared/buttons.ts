import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY } from './constants'
import { createButtons, createClosedEmbed, createEmbed, createFullEmbed } from './embeds'

export const handleJoin = async (interaction: ButtonInteraction<CacheType>, queueId: string) => {
	const response = await apiClient.v1.queues[':id'].players.$post({
		param: { id: queueId },
		json: {
			discordId: interaction.user.id,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message =
			error.message === 'Already joined'
				? '既に参加しています。'
				: error.message === 'Queue is full'
					? '定員に達しています。'
					: error.message === 'Queue is not open'
						? '募集は終了しています。'
						: '参加に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const data = await response.json()

	// 募集情報取得
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: queueId },
	})

	if (!recruitResponse.ok) {
		logger.error('募集情報取得失敗:', recruitResponse.status)
		await interaction.reply({
			content: '募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = await recruitResponse.json()

	const isAnonymous = recruitData.queue.anonymous
	const participantIds = recruitData.players.map((p) => p.discordId)

	if (data.isFull) {
		const fullEmbed = createFullEmbed(participantIds, recruitData.queue.creatorId)
		await interaction.update({
			embeds: [fullEmbed],
			components: [],
		})

		const mentions = participantIds.map((id: string) => `<@${id}>`).join(' ')
		await interaction.followUp({
			content: `募集完了! ${mentions}`,
		})
	} else {
		const embed = createEmbed(isAnonymous, participantIds, CAPACITY, recruitData.queue.creatorId)
		const buttons = createButtons(queueId, false)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

export const handleLeave = async (interaction: ButtonInteraction<CacheType>, queueId: string) => {
	const response = await apiClient.v1.queues[':id'].players[':discordId'].$delete({
		param: {
			id: queueId,
			discordId: interaction.user.id,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message = error.message === 'Player not found' ? '参加していません。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: queueId },
	})

	if (!recruitResponse.ok) {
		logger.error('募集情報取得失敗:', recruitResponse.status)
		await interaction.reply({
			content: '募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = await recruitResponse.json()

	const isAnonymous = recruitData.queue.anonymous
	const participantIds = recruitData.players.map((p) => p.discordId)

	const embed = createEmbed(isAnonymous, participantIds, CAPACITY, recruitData.queue.creatorId)
	const buttons = createButtons(queueId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleForceStart = async (interaction: ButtonInteraction<CacheType>, queueId: string) => {
	// 募集情報取得
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: queueId },
	})

	if (!recruitResponse.ok) {
		logger.error('募集情報取得失敗:', recruitResponse.status)
		await interaction.reply({
			content: '募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = await recruitResponse.json()

	// 主催者チェック
	if (recruitData.queue.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '強制開始できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 既に終了済みチェック
	if (recruitData.queue.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 参加者がいない場合
	if (recruitData.players.length === 0) {
		await interaction.reply({
			content: '参加者がいないため開始できません。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 募集終了API呼び出し（物理削除）
	const closeResponse = await apiClient.v1.queues[':id'].$delete({
		param: { id: queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '強制開始に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const participants = recruitData.players.map((p) => p.discordId)

	const fullEmbed = createFullEmbed(participants, recruitData.queue.creatorId)

	await interaction.update({
		embeds: [fullEmbed],
		components: [],
	})

	const mentions = participants.map((id: string) => `<@${id}>`).join(' ')
	await interaction.followUp({
		content: `強制開始! ${mentions}`,
	})
}

export const handleClose = async (interaction: ButtonInteraction<CacheType>, queueId: string) => {
	// 募集情報取得
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: queueId },
	})

	if (!recruitResponse.ok) {
		logger.error('募集情報取得失敗:', recruitResponse.status)
		await interaction.reply({
			content: '募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = await recruitResponse.json()

	// 主催者チェック
	if (recruitData.queue.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '募集を終了できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 既に終了済みチェック
	if (recruitData.queue.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 募集終了API呼び出し（物理削除）
	const closeResponse = await apiClient.v1.queues[':id'].$delete({
		param: { id: queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '募集の終了に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const isAnonymous = recruitData.queue.anonymous
	const participants = recruitData.players.map((p) => p.discordId)

	const closedEmbed = createClosedEmbed(isAnonymous, participants, CAPACITY, recruitData.queue.creatorId)

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}
