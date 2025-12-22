import type { ButtonInteraction, CacheType } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { balanceTeamsByElo } from '../shared/balance'
import { CAPACITY, INITIAL_RATING } from '../shared/constants'
import {
	createMatchEmbed,
	createRankedButtons,
	createRankedEmbed,
	createRoleSelectMenu,
	createVoteButtons,
} from './embeds'
import type { Participant } from '../shared/types'

export const handleRankJoin = async (interaction: ButtonInteraction<CacheType>, recruitmentId: string) => {
	// まず参加処理を行う（ロール選択前に参加させることで、update-roleが機能する）
	const joinResponse = await apiClient.v1.queues[':id'].players.$post({
		param: { id: recruitmentId },
		json: {
			discordId: interaction.user.id,
		},
	})

	if (!joinResponse.ok) {
		const error = (await joinResponse.json()) as { message?: string }
		const message =
			error.message === 'Already joined'
				? '既に参加しています。'
				: error.message === 'Recruitment is full'
					? '定員に達しています。'
					: error.message === 'Recruitment is not open'
						? '募集は終了しています。'
						: '参加に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const joinData = (await joinResponse.json()) as {
		player: {
			discordId: string
			mainRole: string | null
			subRole: string | null
		}
		isFull: boolean
		count: number
	}

	// 募集情報取得
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: recruitmentId },
	})

	if (!recruitResponse.ok) {
		await interaction.reply({
			content: '参加しましたが、募集情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const recruitData = (await recruitResponse.json()) as {
		queue: {
			creatorId: string
			startTime: string | null
		}
		players: Participant[]
	}

	// 元のメッセージを更新
	const existingDescription = interaction.message.embeds[0]?.description ?? null
	const embed = createRankedEmbed(
		recruitData.players,
		CAPACITY,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
		existingDescription,
	)

	// 10人揃った場合は別処理
	if (joinData.isFull && interaction.guildId) {
		await interaction.update({
			embeds: [embed],
			components: [],
		})

		// チーム分け＆試合作成
		await startRankedMatchFromFull(interaction, recruitmentId, recruitData.players)
		return
	}

	const buttons = createRankedButtons(recruitmentId, false)
	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})

	// ロール選択UIを表示
	const mainRoleSelect = createRoleSelectMenu(recruitmentId, 'main')
	const subRoleSelect = createRoleSelectMenu(recruitmentId, 'sub')
	const originalMessageId = interaction.message.id

	await interaction.followUp({
		content: '参加しました！ロールを選択してください。\n選択後、「完了」ボタンを押してください。',
		components: [
			mainRoleSelect,
			subRoleSelect,
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`recruit:confirm_rank_join:${recruitmentId}:${originalMessageId}`)
					.setLabel('完了')
					.setStyle(ButtonStyle.Success),
			),
		],
		flags: MessageFlags.Ephemeral,
	})
}

export const handleConfirmRankJoin = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
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

	// 募集情報を取得（ロール選択後の最新状態）
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
		param: { id: recruitmentId },
	})

	if (!recruitResponse.ok) {
		await interaction.update({
			content: 'ロールを設定しました。',
			components: [],
		})
		return
	}

	const recruitData = (await recruitResponse.json()) as {
		queue: {
			creatorId: string
			startTime: string | null
		}
		players: Participant[]
	}

	await interaction.update({
		content: 'ロールを設定しました。',
		components: [],
	})

	// 元のメッセージを取得して更新
	const channel = interaction.channel
	if (!channel) {
		logger.error('チャンネルが見つかりません')
		return
	}

	const originalMessage = await channel.messages.fetch(originalMessageId)
	const existingDescription = originalMessage.embeds[0]?.description ?? null

	const embed = createRankedEmbed(
		recruitData.players,
		CAPACITY,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
		existingDescription,
	)
	const buttons = createRankedButtons(recruitmentId, false)

	await originalMessage.edit({
		embeds: [embed],
		components: [buttons],
	})
}

// 10人揃った時のチーム分け＆試合作成
const startRankedMatchFromFull = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	participants: Participant[],
) => {
	if (!interaction.guildId) return

	// 募集終了
	await apiClient.v1.queues[':id'].$delete({
		param: { id: recruitmentId },
	})

	// チーム分け＆試合作成
	const matchId = crypto.randomUUID()

	// レーティング取得
	const discordIds = participants.map((p) => p.discordId)
	const ratingsResponse = await apiClient.v1.guilds[':guildId'].ratings.$get({
		param: { guildId: interaction.guildId },
		query: { id: discordIds },
	})

	type RatingResponse = {
		ratings: Array<{
			discordId: string
			rating: number | null
		}>
	}

	let ratings: RatingResponse['ratings'] = []
	if (ratingsResponse.ok) {
		const ratingsData = (await ratingsResponse.json()) as RatingResponse
		ratings = ratingsData.ratings
	}

	// レーティングを参加者にマッピング
	const participantsWithRating = participants.map((p) => {
		const ratingInfo = ratings.find((r) => r.discordId === p.discordId)
		return {
			discordId: p.discordId,
			mainRole: p.mainRole as LolRole | null,
			subRole: p.subRole as LolRole | null,
			rating: ratingInfo?.rating ?? INITIAL_RATING,
		}
	})

	// チームバランス
	const teamAssignments = balanceTeamsByElo(participantsWithRating)

	// API用に大文字形式に変換
	const teamAssignmentsForAPI = Object.fromEntries(
		Object.entries(teamAssignments).map(([discordId, assignment]) => [
			discordId,
			{
				team: assignment.team.toUpperCase() as 'BLUE' | 'RED',
				role: assignment.role,
				rating: assignment.rating,
			},
		]),
	)

	// 試合作成API呼び出し
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches.$post({
		param: { guildId: interaction.guildId },
		json: {
			id: matchId,
			channelId: interaction.channelId,
			messageId: interaction.message.id,
			teamAssignments: teamAssignmentsForAPI,
		},
	})

	if (matchResponse.ok) {
		const matchEmbed = createMatchEmbed(teamAssignments, 0, 0, 6)
		const voteButtons = createVoteButtons(matchId)

		const mentions = participants.map((p) => `<@${p.discordId}>`).join(' ')
		await interaction.followUp({
			content: `🏆 ランク戦募集完了！チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
			embeds: [matchEmbed],
			components: [voteButtons],
		})
	}
}

export const handleRankLeave = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	existingDescription: string | null,
) => {
	// ランク戦キャンセル
	const response = await apiClient.v1.queues[':id'].players[':discordId'].$delete({
		param: {
			id: recruitmentId,
			discordId: interaction.user.id,
		},
	})

	if (!response.ok) {
		const error = (await response.json()) as { message?: string }
		const message = error.message === 'Not joined' ? '参加していません。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const data = (await response.json()) as {
		success: boolean
		count: number
		players: Participant[]
	}

	const recruitResponse = await apiClient.v1.queues[':id'].$get({
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
		queue: {
			creatorId: string
			startTime: string | null
		}
	}

	const embed = createRankedEmbed(
		data.players,
		CAPACITY,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
		existingDescription,
	)
	const buttons = createRankedButtons(recruitmentId, false)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})
}

export const handleRankForce = async (
	interaction: ButtonInteraction<CacheType>,
	recruitmentId: string,
	_existingDescription: string | null,
) => {
	// ランク戦強制開始
	const recruitResponse = await apiClient.v1.queues[':id'].$get({
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
		queue: {
			guildId: string
			creatorId: string
			startTime: string | null
			status: string
		}
		players: Participant[]
	}

	// 管理者権限チェック（ランク戦は管理者のみ強制開始可能）
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
		await interaction.reply({
			content: '強制開始できるのはサーバー管理者のみです。',
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

	// 募集終了API呼び出し
	const closeResponse = await apiClient.v1.queues[':id'].$delete({
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

	// チーム分け＆試合作成
	await startRankedMatch(interaction, recruitData.queue.guildId, recruitData.players)
}

// ランク戦試合開始（チーム分け＆投票開始）
const startRankedMatch = async (
	interaction: ButtonInteraction<CacheType>,
	guildId: string,
	participants: Participant[],
) => {
	// 参加者のレーティングを取得
	const discordIds = participants.map((p) => p.discordId)
	const ratingsResponse = await apiClient.v1.guilds[':guildId'].ratings.$get({
		param: { guildId },
		query: { id: discordIds },
	})

	type RatingResponse = {
		ratings: Array<{
			discordId: string
			rating: number | null
		}>
	}

	let ratings: RatingResponse['ratings'] = []
	if (ratingsResponse.ok) {
		const data = (await ratingsResponse.json()) as RatingResponse
		ratings = data.ratings
	}

	// レーティングを参加者にマッピング（未登録は初期値1500）
	const participantsWithRating = participants.map((p) => {
		const ratingInfo = ratings.find((r) => r.discordId === p.discordId)
		return {
			discordId: p.discordId,
			mainRole: p.mainRole as LolRole | null,
			subRole: p.subRole as LolRole | null,
			rating: ratingInfo?.rating ?? INITIAL_RATING,
		}
	})

	// チームバランス
	const teamAssignments = balanceTeamsByElo(participantsWithRating)

	// 試合ID生成
	const matchId = crypto.randomUUID()

	// API用に大文字形式に変換
	const teamAssignmentsForAPI = Object.fromEntries(
		Object.entries(teamAssignments).map(([discordId, assignment]) => [
			discordId,
			{
				team: assignment.team.toUpperCase() as 'BLUE' | 'RED',
				role: assignment.role,
				rating: assignment.rating,
			},
		]),
	)

	// 試合作成API呼び出し
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches.$post({
		param: { guildId },
		json: {
			id: matchId,
			channelId: interaction.channelId,
			messageId: interaction.message.id,
			teamAssignments: teamAssignmentsForAPI,
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

	// 投票UI表示
	const embed = createMatchEmbed(teamAssignments, 0, 0, 6)
	const buttons = createVoteButtons(matchId)

	await interaction.update({
		embeds: [embed],
		components: [buttons],
	})

	const mentions = participants.map((p) => `<@${p.discordId}>`).join(' ')
	await interaction.followUp({
		content: `🏆 チーム分けが完了しました！ ${mentions}\n\n試合終了後、勝利チームを投票してください。`,
	})
}
