import type { ButtonInteraction, CacheType, Message } from 'discord.js'
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
import { balanceTeamsByElo } from '../shared/balance'
import { CAPACITY, INITIAL_RATING } from '../shared/constants'
import type { Participant } from '../shared/types'
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

export const handleRankJoin = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	// Check if already joined via API
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$get({
		param: { guildId, queueId },
	})

	if (!recruitResponse.ok) {
		await interaction.reply({
			content: '募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = await recruitResponse.json()

	// Check if recruitment is still open
	if (recruitData.status === 'closed') {
		await interaction.reply({
			content: '募集は終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Check if already joined
	if (recruitData.players.some((p) => p.discordId === interaction.user.id)) {
		await interaction.reply({
			content: '既に参加しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Check if queue is full
	if (recruitData.players.length >= CAPACITY) {
		await interaction.reply({
			content: '定員に達しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Initialize pending role selection
	const pendingKey = `${queueId}:${interaction.user.id}`
	pendingRoleSelections.set(pendingKey, { mainRole: null, subRole: null })

	// Show role selection UI (do not join yet)
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
	// originalMessageIdがない場合はエラー
	if (!originalMessageId) {
		await interaction.update({
			content: 'エラー: 元のメッセージが見つかりません。',
			components: [],
		})
		return
	}

	// Get pending role selection
	const pendingKey = `${queueId}:${interaction.user.id}`
	const pendingRoles = pendingRoleSelections.get(pendingKey)

	if (!pendingRoles) {
		await interaction.update({
			content: 'エラー: ロール選択情報が見つかりません。もう一度参加ボタンを押してください。',
			components: [],
		})
		return
	}

	// Validate that both roles are selected
	if (!pendingRoles.mainRole || !pendingRoles.subRole) {
		await interaction.reply({
			content: 'メインロールとサブロールの両方を選択してください。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Join the queue via API with roles
	const joinResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].players.$post({
		param: { guildId, queueId },
		json: {
			discordId: interaction.user.id,
			mainRole: pendingRoles.mainRole,
			subRole: pendingRoles.subRole,
		},
	})

	if (!joinResponse.ok) {
		const error = await joinResponse.json()
		const message =
			error.message === 'Already joined'
				? '既に参加しています。'
				: error.message === 'Recruitment is full'
					? '定員に達しています。'
					: error.message === 'Recruitment is not open'
						? '募集は終了しています。'
						: '参加に失敗しました。'

		pendingRoleSelections.delete(pendingKey)
		await interaction.update({
			content: message,
			components: [],
		})
		return
	}

	// Clean up pending selection
	pendingRoleSelections.delete(pendingKey)

	// Fetch updated queue info
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$get({
		param: { guildId, queueId },
	})

	if (!recruitResponse.ok) {
		await interaction.update({
			content: '参加しました！',
			components: [],
		})
		return
	}

	const recruitData = await recruitResponse.json()

	await interaction.update({
		content: '参加しました！',
		components: [],
	})

	// Get original message and update
	const channel = interaction.channel
	if (!channel) {
		logger.error('Channel not found')
		return
	}

	const originalMessage = await channel.messages.fetch(originalMessageId)

	const embed = createRankedEmbed(recruitData.players, CAPACITY, recruitData.creatorId ?? '不明')

	// If queue is now full, start the match
	if (recruitData.status === 'full') {
		await originalMessage.edit({
			embeds: [embed],
			components: [],
		})

		await startRankedMatchFromFull(
			interaction,
			originalMessage,
			guildId,
			queueId,
			recruitData.players,
		)
		return
	}

	const buttons = createRankedButtons(guildId, queueId, false)
	await originalMessage.edit({
		embeds: [embed],
		components: [buttons],
	})
}

// Start ranked match when queue is full (team assignment & voting)
const startRankedMatchFromFull = async (
	interaction: ButtonInteraction<CacheType>,
	originalMessage: Message,
	guildId: string,
	queueId: string,
	participants: Participant[],
) => {
	// Close the recruitment first - must succeed before creating match
	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$delete({
		param: { guildId, queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		// Re-enable buttons since queue is still open
		const embed = createRankedEmbed(participants, CAPACITY, interaction.user.id)
		const buttons = createRankedButtons(guildId, queueId, false)
		await originalMessage.edit({
			embeds: [embed],
			components: [buttons],
		})
		await interaction.followUp({
			content: '試合の開始に失敗しました。もう一度お試しください。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// Fetch ratings for participants individually
	const participantsWithRating = await Promise.all(
		participants.map(async (p) => {
			const statsResponse = await apiClient.v1.guilds[':guildId'].users[':discordId'].stats.$get({
				param: { guildId, discordId: p.discordId },
			})
			const rating = statsResponse.ok ? (await statsResponse.json()).rating : INITIAL_RATING
			return {
				discordId: p.discordId,
				mainRole: p.mainRole,
				subRole: p.subRole,
				rating,
			}
		}),
	)

	// Balance teams
	const teamAssignments = balanceTeamsByElo(participantsWithRating)

	// Convert to players array format for API
	const playersForAPI = Object.entries(teamAssignments).map(([discordId, assignment]) => ({
		discordId,
		team: assignment.team,
		role: assignment.role,
		ratingBefore: assignment.rating,
	}))

	// Create match via API
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches.$post({
		param: { guildId },
		json: {
			channelId: interaction.channelId,
			messageId: originalMessage.id,
			players: playersForAPI,
		},
	})

	if (matchResponse.ok && originalMessage.channel.isSendable()) {
		const matchData = await matchResponse.json()
		const matchEmbed = createMatchEmbed(teamAssignments, 0, 0, 0, 6)
		const voteButtons = createVoteButtons(matchData.id)

		const mentions = participants.map((p) => `<@${p.discordId}>`).join(' ')
		await originalMessage.channel.send({
			content: `🏆 ランク戦募集完了！チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
			embeds: [matchEmbed],
			components: [voteButtons],
		})
	}
}

export const handleRankLeave = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	// ランク戦キャンセル
	const response = await apiClient.v1.guilds[':guildId'].queues[':queueId'].players[
		':discordId'
	].$delete({
		param: {
			guildId,
			queueId,
			discordId: interaction.user.id,
		},
	})

	if (!response.ok) {
		const error = await response.json()
		const message =
			error.message === 'Not joined' ? '参加していません。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$get({
		param: { guildId, queueId },
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

	const embed = createRankedEmbed(recruitData.players, CAPACITY, recruitData.creatorId ?? '不明')
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
	// ランク戦強制開始
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$get({
		param: { guildId, queueId },
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

	// 管理者権限チェック（ランク戦は管理者のみ強制開始可能）
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
		await interaction.reply({
			content: '強制開始できるのはサーバー管理者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.status === 'closed') {
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

	// 募集終了API呼び出し
	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$delete({
		param: { guildId, queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '強制開始に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// チーム分け＆試合作成
	await startRankedMatch(interaction, guildId, recruitData.players)
}

// ランク戦試合開始（チーム分け＆投票開始）
const startRankedMatch = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	participants: Participant[],
) => {
	// 参加者のレーティングを取得
	const participantsWithRating = await Promise.all(
		participants.map(async (p) => {
			const statsResponse = await apiClient.v1.guilds[':guildId'].users[':discordId'].stats.$get({
				param: { guildId, discordId: p.discordId },
			})
			const rating = statsResponse.ok ? (await statsResponse.json()).rating : INITIAL_RATING
			return {
				discordId: p.discordId,
				mainRole: p.mainRole,
				subRole: p.subRole,
				rating,
			}
		}),
	)

	// チームバランス
	const teamAssignments = balanceTeamsByElo(participantsWithRating)

	// API用に players 配列形式に変換
	const playersForAPI = Object.entries(teamAssignments).map(([discordId, assignment]) => ({
		discordId,
		team: assignment.team,
		role: assignment.role,
		ratingBefore: assignment.rating,
	}))

	// 試合作成API呼び出し
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches.$post({
		param: { guildId },
		json: {
			channelId: interaction.channelId,
			messageId: interaction.message.id,
			players: playersForAPI,
		},
	})

	if (!matchResponse.ok) {
		logger.error('試合作成失敗:', matchResponse.status)
		await interaction.update({
			content: '試合の作成に失敗しました。',
			embeds: [],
			components: [],
		})
		return
	}

	const matchData = await matchResponse.json()

	// 投票UI表示
	const embed = createMatchEmbed(teamAssignments, 0, 0, 0, 6)
	const buttons = createVoteButtons(matchData.id)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})

	const mentions = participants.map((p) => `<@${p.discordId}>`).join(' ')
	await interaction.followUp({
		content: `🏆 チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
	})
}

export const handleRankClose = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	queueId: string,
) => {
	const recruitResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$get({
		param: { guildId, queueId },
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

	// 主催者または管理者のみ終了可能
	const isCreator = recruitData.creatorId ?? '不明' === interaction.user.id
	const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)

	if (!isCreator && !isAdmin) {
		await interaction.reply({
			content: '募集を終了できるのは主催者またはサーバー管理者のみです。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	if (recruitData.status === 'closed') {
		await interaction.reply({
			content: 'この募集は既に終了しています。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closeResponse = await apiClient.v1.guilds[':guildId'].queues[':queueId'].$delete({
		param: { guildId, queueId },
	})

	if (!closeResponse.ok) {
		logger.error('募集終了失敗:', closeResponse.status)
		await interaction.reply({
			content: '募集の終了に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const closedEmbed = createRankedClosedEmbed(
		recruitData.players,
		CAPACITY,
		recruitData.creatorId ?? '不明',
	)

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}
