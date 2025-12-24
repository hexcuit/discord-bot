import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY } from '../shared/constants'
import { createButtons, createClosedEmbed, createEmbed, createFullEmbed } from './embeds'

export const handleJoin = async (interaction: ButtonInteraction<CacheType>, guildId: string, queueId: string) => {
	const response = await apiClient.v1.guilds[':guildId'].queues[':id'].players.$post({
		param: { guildId, id: queueId },
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

	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$get({
		param: { guildId, id: queueId },
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
	const participantCount = recruitData.players.length

	if (data.isFull) {
		const fullEmbed = createFullEmbed(participantCount, recruitData.queue.creatorId)
		await interaction.update({
			embeds: [fullEmbed],
			components: [],
		})

		await interaction.followUp({
			content: '募集完了!',
		})
	} else {
		const embed = createEmbed(participantCount, CAPACITY, recruitData.queue.creatorId)
		const buttons = createButtons(guildId, queueId, false)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

export const handleLeave = async (interaction: ButtonInteraction<CacheType>, guildId: string, queueId: string) => {
	const response = await apiClient.v1.guilds[':guildId'].queues[':id'].players[':discordId'].$delete({
		param: {
			guildId,
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

	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$get({
		param: { guildId, id: queueId },
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
	const participantCount = recruitData.players.length

	const embed = createEmbed(participantCount, CAPACITY, recruitData.queue.creatorId)
	const buttons = createButtons(guildId, queueId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleForce = async (interaction: ButtonInteraction<CacheType>, guildId: string, queueId: string) => {
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$get({
		param: { guildId, id: queueId },
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

	if (recruitData.queue.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '強制開始できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.queue.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.players.length === 0) {
		await interaction.reply({
			content: '参加者がいないため開始できません。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$delete({
		param: { guildId, id: queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '強制開始に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const participantCount = recruitData.players.length
	const fullEmbed = createFullEmbed(participantCount, recruitData.queue.creatorId)

	await interaction.update({
		embeds: [fullEmbed],
		components: [],
	})

	await interaction.followUp({
		content: '強制開始!',
	})
}

export const handleClose = async (interaction: ButtonInteraction<CacheType>, guildId: string, queueId: string) => {
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$get({
		param: { guildId, id: queueId },
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

	if (recruitData.queue.creatorId !== interaction.user.id) {
		await interaction.reply({
			content: '募集を終了できるのは主催者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.queue.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':id'].$delete({
		param: { guildId, id: queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '募集の終了に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const participantCount = recruitData.players.length
	const closedEmbed = createClosedEmbed(participantCount, CAPACITY, recruitData.queue.creatorId)

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}
