import type { ButtonInteraction, CacheType } from 'discord.js'

import { MessageFlags, PermissionFlagsBits } from 'discord.js'

import type { RolePreference } from '@/constants'

import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'

import { CAPACITY, ROLE_LABELS } from '../shared/constants'
import {
	createMatchEmbed,
	createRankedButtons,
	createRankedClosedEmbed,
	createRankedEmbed,
	createRoleButtons,
	createVoteButtons,
} from './embeds'

// Extract creatorId from embed footer (format: "主催: {creatorId}")
const getCreatorIdFromEmbed = (interaction: ButtonInteraction<CacheType>): string | null => {
	const footer = interaction.message.embeds[0]?.footer?.text
	if (!footer) return null
	const match = footer.match(/主催: (.+)/)
	return match?.[1] ?? null
}

export const handleRankJoin = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	const originalMessageId = interaction.message.id
	const roleButtons = createRoleButtons(guildId, queueId, originalMessageId, 'main')

	await interaction.reply({
		content: '**メインロール**を選択してください',
		components: roleButtons,
		flags: MessageFlags.Ephemeral,
	})
}

/**
 * キューに参加する共通処理
 */
const joinQueue = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
	originalMessageId: string,
	mainRole: RolePreference,
	subRole: RolePreference,
) => {
	const joinResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].join.$post({
		param: { guildId, queueId },
		json: {
			discordId: interaction.user.id,
			mainRole,
			subRole,
		},
	})

	if (!joinResponse.ok) {
		const error = await joinResponse.json()
		const message =
			error.message === 'Already joined'
				? '既に参加しています。'
				: error.message === 'Queue is full'
					? '定員に達しています。'
					: error.message === 'Queue is closed'
						? '募集は終了しています。'
						: '参加に失敗しました。'

		await interaction.update({
			content: message,
			components: [],
		})
		return
	}

	const joinData = await joinResponse.json()

	await interaction.update({
		content: `✅ 参加しました！\nメイン: **${ROLE_LABELS[mainRole]}** / サブ: **${ROLE_LABELS[subRole]}**`,
		components: [],
	})

	const channel = interaction.channel
	if (!channel) {
		logger.error('Channel not found')
		return
	}

	const originalMessage = await channel.messages.fetch(originalMessageId)

	// Check if match started (queue was full)
	if (joinData.status === 'match_started') {
		const { match } = joinData
		const matchEmbed = createMatchEmbed(match.teamAssignments, 0, 0, 0, 6)
		const voteButtons = createVoteButtons(match.id)

		const closedEmbed = createRankedClosedEmbed([], CAPACITY, joinData.creatorId ?? '不明')
		await originalMessage.edit({
			embeds: [closedEmbed],
			components: [],
		})

		if (originalMessage.channel.isSendable()) {
			const mentions = Object.keys(match.teamAssignments)
				.map((id) => `<@${id}>`)
				.join(' ')
			await originalMessage.channel.send({
				content: `🏆 ランク戦募集完了！チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
				embeds: [matchEmbed],
				components: [voteButtons],
			})
		}

		return
	}

	// Still recruiting - update embed with new players
	const embed = createRankedEmbed(joinData.players, joinData.capacity, joinData.creatorId ?? '不明')
	const buttons = createRankedButtons(guildId, queueId, false)
	await originalMessage.edit({
		embeds: [embed],
		components: [buttons],
	})
}

/**
 * ロール選択ボタンのハンドラー
 * メイン選択時: FILLなら即参加、それ以外はサブ選択画面へ遷移
 * サブ選択時: 自動的にキューに参加
 */
export const handleRoleSelect = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
	originalMessageId: string,
	type: 'main' | 'sub',
	role: RolePreference,
	mainRole?: RolePreference,
) => {
	if (type === 'main') {
		// メインでFILLを選択した場合はサブ選択をスキップして即参加
		if (role === 'FILL') {
			await joinQueue(interaction, guildId, queueId, originalMessageId, 'FILL', 'FILL')
			return
		}

		// メイン選択完了 → サブ選択へ
		const roleButtons = createRoleButtons(guildId, queueId, originalMessageId, 'sub', role)
		await interaction.update({
			content: `メイン: **${ROLE_LABELS[role]}**\n\n**サブロール**を選択してください`,
			components: roleButtons,
		})
		return
	}

	// サブ選択完了 → 自動的に参加
	if (!mainRole) {
		await interaction.update({
			content: 'エラー: メインロールが見つかりません。もう一度参加ボタンを押してください。',
			components: [],
		})
		return
	}

	await joinQueue(interaction, guildId, queueId, originalMessageId, mainRole, role)
}

export const handleRankLeave = async (
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

	const embed = createRankedEmbed(
		leaveData.players,
		leaveData.capacity,
		leaveData.creatorId ?? '不明',
	)
	const buttons = createRankedButtons(guildId, queueId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleRankForce = async (
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

	// Display match embed
	const matchEmbed = createMatchEmbed(match.teamAssignments, 0, 0, 0, 6)
	const voteButtons = createVoteButtons(match.id)

	await interaction.update({
		embeds: [matchEmbed],
		components: [voteButtons],
	})

	const mentions = Object.keys(match.teamAssignments)
		.map((id) => `<@${id}>`)
		.join(' ')
	await interaction.followUp({
		content: `🏆 チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
	})
}

export const handleRankClose = async (
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

	const closedEmbed = createRankedClosedEmbed([], CAPACITY, creatorId ?? '不明')

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}
