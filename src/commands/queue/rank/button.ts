import type { ButtonInteraction, CacheType } from 'discord.js'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	PermissionFlagsBits,
} from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { CAPACITY } from '../shared/constants'
import {
	createMatchEmbed,
	createRankedButtons,
	createRankedClosedEmbed,
	createRankedEmbed,
	createRoleSelectMenu,
	createVoteButtons,
} from './embeds'

// Temporary storage for pending role selections (before join is confirmed)
// Key: `${queueId}:${discordId}`, Value: { mainRole, subRole }
export const pendingRoleSelections = new Map<
	string,
	{ mainRole: LolRole | null; subRole: LolRole | null }
>()

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
	// Initialize pending role selection
	const pendingKey = `${queueId}:${interaction.user.id}`
	pendingRoleSelections.set(pendingKey, { mainRole: null, subRole: null })

	// Show role selection UI (validation happens on confirm)
	const mainRoleSelect = createRoleSelectMenu(guildId, queueId, 'main')
	const subRoleSelect = createRoleSelectMenu(guildId, queueId, 'sub')
	const originalMessageId = interaction.message.id

	await interaction.reply({
		content: 'ロールを選択してください。\n選択後、「参加確定」ボタンを押してください。',
		components: [
			mainRoleSelect,
			subRoleSelect,
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`queue:confirm_rank_join:${guildId}:${queueId}:${originalMessageId}`)
					.setLabel('参加確定')
					.setStyle(ButtonStyle.Success),
			),
		],
		flags: MessageFlags.Ephemeral,
	})
}

export const handleConfirmRankJoin = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
	originalMessageId: string | undefined,
) => {
	if (!originalMessageId) {
		await interaction.update({
			content: 'エラー: 元のメッセージが見つかりません。',
			components: [],
		})
		return
	}

	const pendingKey = `${queueId}:${interaction.user.id}`
	const pendingRoles = pendingRoleSelections.get(pendingKey)

	if (!pendingRoles) {
		await interaction.update({
			content: 'エラー: ロール選択情報が見つかりません。もう一度参加ボタンを押してください。',
			components: [],
		})
		return
	}

	if (!pendingRoles.mainRole || !pendingRoles.subRole) {
		await interaction.reply({
			content: 'メインロールとサブロールの両方を選択してください。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Join the queue via API
	const joinResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].join.$post({
		param: { guildId, queueId },
		json: {
			discordId: interaction.user.id,
			mainRole: pendingRoles.mainRole,
			subRole: pendingRoles.subRole,
		},
	})

	pendingRoleSelections.delete(pendingKey)

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
		content: '参加しました！',
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
		// Match was auto-created by server
		const { match } = joinData
		const matchEmbed = createMatchEmbed(match.teamAssignments, 0, 0, 0, 6)
		const voteButtons = createVoteButtons(match.id)

		// Update original message to show closed state
		const closedEmbed = createRankedClosedEmbed([], CAPACITY, joinData.creatorId ?? '不明')
		await originalMessage.edit({
			embeds: [closedEmbed],
			components: [],
		})

		// Send match message
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
