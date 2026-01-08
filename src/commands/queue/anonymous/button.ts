import type { ButtonInteraction, CacheType } from 'discord.js'
import { MessageFlags, PermissionFlagsBits } from 'discord.js'
import { apiClient } from '@/utils/api-client'
import { CAPACITY } from '../shared/constants'
import { createButtons, createClosedEmbed, createEmbed, createFullEmbed } from './embeds'

// Extract creatorId from embed footer (format: "主催: {creatorId}")
const getCreatorIdFromEmbed = (interaction: ButtonInteraction<CacheType>): string | null => {
	const footer = interaction.message.embeds[0]?.footer?.text
	if (!footer) return null
	const match = footer.match(/主催: (.+)/)
	return match?.[1] ?? null
}

export const handleJoin = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	// Join the queue via API (no role selection needed - server uses FILL as default)
	const response = await apiClient.v1.guilds[':guildId'].queues[':queueId'].join.$post({
		param: { guildId, queueId },
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
					: error.message === 'Queue is closed'
						? '募集は終了しています。'
						: '参加に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const joinData = await response.json()

	// Check if match started (queue was full)
	if (joinData.status === 'match_started') {
		// Match was auto-created by server
		const participantCount = Object.keys(joinData.match.teamAssignments).length
		const fullEmbed = createFullEmbed(participantCount, joinData.creatorId ?? '不明')

		await interaction.update({
			embeds: [fullEmbed],
			components: [],
		})

		await interaction.followUp({
			content: '募集完了!',
		})
		return
	}

	// Still recruiting - update embed with new count
	const participantCount = joinData.players.length
	const embed = createEmbed(participantCount, joinData.capacity, joinData.creatorId ?? '不明')
	const buttons = createButtons(guildId, queueId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleLeave = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	const response = await apiClient.v1.guilds[':guildId'].queues[':queueId'].leave.$post({
		param: { guildId, queueId },
		json: {
			discordId: interaction.user.id,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message =
			error.message === 'Not in queue' ? '参加していません。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const leaveData = await response.json()
	const participantCount = leaveData.players.length

	const embed = createEmbed(participantCount, leaveData.capacity, leaveData.creatorId ?? '不明')
	const buttons = createButtons(guildId, queueId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleForce = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	// Check permissions - creator or admin
	const creatorId = getCreatorIdFromEmbed(interaction)
	const isCreator = creatorId === interaction.user.id
	const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)

	if (!isCreator && !isAdmin) {
		await interaction.reply({
			content: '強制開始できるのは主催者またはサーバー管理者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Call start endpoint - server handles team balancing and match creation
	const startResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].start.$post({
		param: { guildId, queueId },
	})

	if (!startResponse.ok) {
		const error = await startResponse.json()
		const message =
			error.message === 'Queue not found'
				? '募集が見つかりません。'
				: error.message === 'Queue is closed'
					? '募集は既に終了しています。'
					: error.message === 'Not enough players (minimum 2)'
						? '参加者が2人未満のため開始できません。'
						: '強制開始に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const { match } = await startResponse.json()
	const participantCount = Object.keys(match.teamAssignments).length

	const fullEmbed = createFullEmbed(participantCount, creatorId ?? '不明')

	await interaction.update({
		embeds: [fullEmbed],
		components: [],
	})

	await interaction.followUp({
		content: '強制開始!',
	})
}

export const handleClose = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	// Check permissions - creator or admin
	const creatorId = getCreatorIdFromEmbed(interaction)
	const isCreator = creatorId === interaction.user.id
	const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)

	if (!isCreator && !isAdmin) {
		await interaction.reply({
			content: '募集を終了できるのは主催者またはサーバー管理者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$delete({
		param: { guildId, queueId },
	})

	if (!closeResponse.ok) {
		const error = await closeResponse.json()
		const message =
			error.message === 'Queue not found' ? '募集が見つかりません。' : '募集の終了に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closedEmbed = createClosedEmbed(0, CAPACITY, creatorId ?? '不明')

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}
