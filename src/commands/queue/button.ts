import type { ButtonInteraction, CacheType } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import {
	balanceTeamsByElo,
	CAPACITY,
	createButtons,
	createClosedEmbed,
	createEmbed,
	createFullEmbed,
	createMatchEmbed,
	createMatchResultEmbed,
	createRankedButtons,
	createRankedEmbed,
	createRoleSelectMenu,
	createVoteButtons,
	type Participant,
	parseCustomId,
	type TeamAssignments,
} from './shared'

// 初期レーティング
const INITIAL_RATING = 1500

export const handleButton = async (interaction: ButtonInteraction<CacheType>) => {
	const { action, recruitmentId, originalMessageId } = parseCustomId(interaction.customId)

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
				await handleConfirmRankJoin(interaction, recruitmentId, originalMessageId)
				break
			case 'rank_leave':
				await handleRankLeave(interaction, recruitmentId, existingDescription)
				break
			case 'rank_force':
				await handleRankForce(interaction, recruitmentId, existingDescription)
				break
			case 'vote_blue':
				await handleVote(interaction, recruitmentId, 'blue')
				break
			case 'vote_red':
				await handleVote(interaction, recruitmentId, 'red')
				break
			case 'vote_cancel':
				await handleVoteCancel(interaction, recruitmentId)
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
	const response = await apiClient.v1.queues[':id'].players.$post({
		param: { id: recruitmentId },
		json: {
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

	const data = await response.json()

	// 募集情報取得
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

	const recruitData = await recruitResponse.json()

	const isAnonymous = recruitData.queue.anonymous
	const participantIds = recruitData.players.map((p) => p.discordId)

	if (data.isFull) {
		const fullEmbed = createFullEmbed(
			participantIds,
			recruitData.queue.creatorId,
			recruitData.queue.startTime,
			existingDescription,
		)
		await interaction.update({
			embeds: [fullEmbed],
			components: [],
		})

		const mentions = participantIds.map((id: string) => `<@${id}>`).join(' ')
		await interaction.followUp({
			content: `募集完了! ${mentions}`,
		})
	} else {
		const embed = createEmbed(
			isAnonymous,
			participantIds,
			CAPACITY,
			recruitData.queue.creatorId,
			recruitData.queue.startTime,
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
			anonymous: boolean
			creatorId: string
			startTime: string | null
		}
	}

	const isAnonymous = recruitData.queue.anonymous
	const participantIds = data.players.map((p) => p.discordId)

	const embed = createEmbed(
		isAnonymous,
		participantIds,
		CAPACITY,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
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
			anonymous: boolean
			creatorId: string
			startTime: string | null
			status: string
		}
		players: { discordId: string }[]
	}

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

	const participants = recruitData.players.map((p) => p.discordId)

	const fullEmbed = createFullEmbed(
		participants,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
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
			anonymous: boolean
			creatorId: string
			startTime: string | null
			status: string
		}
		players: { discordId: string }[]
	}

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

	const isAnonymous = recruitData.queue.anonymous
	const participants = recruitData.players.map((p) => p.discordId)

	const closedEmbed = createClosedEmbed(
		isAnonymous,
		participants,
		CAPACITY,
		recruitData.queue.creatorId,
		recruitData.queue.startTime,
		existingDescription,
	)

	await interaction.update({
		embeds: [closedEmbed],
		components: [],
	})
}

const handleRankJoin = async (interaction: ButtonInteraction<CacheType>, recruitmentId: string) => {
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

const handleConfirmRankJoin = async (
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

const handleRankLeave = async (
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

const handleRankForce = async (
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

// 投票ハンドラー
const handleVote = async (interaction: ButtonInteraction<CacheType>, matchId: string, vote: 'blue' | 'red') => {
	if (!interaction.guildId) {
		await interaction.reply({
			content: 'このコマンドはサーバー内でのみ使用できます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 投票API呼び出し（APIは大文字を期待）
	const voteUpperCase = vote.toUpperCase() as 'BLUE' | 'RED'
	const response = await apiClient.v1.guilds[':guildId'].matches[':matchId'].votes.$post({
		param: { guildId: interaction.guildId, matchId },
		json: {
			discordId: interaction.user.id,
			vote: voteUpperCase,
		},
	})

	if (!response.ok) {
		const error = (await response.json()) as { message?: string }
		const message =
			error.message === 'Not a participant'
				? '試合参加者のみ投票できます。'
				: error.message === 'Match is not in voting state'
					? 'この試合は既に終了しています。'
					: '投票に失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const data = (await response.json()) as {
		changed: boolean
		blueVotes: number
		redVotes: number
		totalParticipants: number
		votesRequired: number
	}

	// 過半数で確定チェック
	if (data.blueVotes >= data.votesRequired || data.redVotes >= data.votesRequired) {
		// 試合確定
		const confirmResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].confirm.$post({
			param: { guildId: interaction.guildId, matchId },
		})

		if (!confirmResponse.ok) {
			logger.error('試合確定失敗:', confirmResponse.status)
			await interaction.reply({
				content: '試合の確定に失敗しました。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const confirmData = (await confirmResponse.json()) as {
			matchId: string
			winningTeam: 'BLUE' | 'RED'
			ratingChanges: Array<{
				discordId: string
				team: 'BLUE' | 'RED'
				ratingBefore: number
				ratingAfter: number
				change: number
				rank: string
			}>
		}

		// 結果Embed（小文字形式に変換）
		const resultEmbed = createMatchResultEmbed(
			confirmData.winningTeam.toLowerCase() as 'blue' | 'red',
			confirmData.ratingChanges.map((rc) => ({
				...rc,
				team: rc.team.toLowerCase() as 'blue' | 'red',
			})),
		)

		await interaction.update({
			embeds: [resultEmbed],
			components: [],
		})
	} else {
		// 投票状況を更新
		const matchResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$get({
			param: { guildId: interaction.guildId, matchId },
		})

		if (!matchResponse.ok) {
			await interaction.reply({
				content: `${vote === 'blue' ? '🔵 Blue' : '🔴 Red'}勝利に投票しました。`,
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const matchData = (await matchResponse.json()) as {
			match: {
				teamAssignments: Record<
					string,
					{
						team: 'BLUE' | 'RED'
						role: LolRole
						rating: number
					}
				>
				blueVotes: number
				redVotes: number
			}
			votesRequired: number
		}

		// API形式（大文字）をアプリ形式（小文字）に変換
		const teamAssignmentsLowerCase: TeamAssignments = Object.fromEntries(
			Object.entries(matchData.match.teamAssignments).map(([discordId, assignment]) => [
				discordId,
				{
					team: assignment.team.toLowerCase() as 'blue' | 'red',
					role: assignment.role,
					rating: assignment.rating,
				},
			]),
		)

		const embed = createMatchEmbed(
			teamAssignmentsLowerCase,
			matchData.match.blueVotes,
			matchData.match.redVotes,
			matchData.votesRequired,
		)
		const buttons = createVoteButtons(matchId)

		await interaction.update({
			embeds: [embed],
			components: [buttons],
		})
	}
}

// 投票キャンセルハンドラー
const handleVoteCancel = async (interaction: ButtonInteraction<CacheType>, matchId: string) => {
	if (!interaction.guildId) {
		await interaction.reply({
			content: 'このコマンドはサーバー内でのみ使用できます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 試合情報取得
	const matchResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$get({
		param: { guildId: interaction.guildId, matchId },
	})

	if (!matchResponse.ok) {
		await interaction.reply({
			content: '試合情報の取得に失敗しました。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	const matchData = (await matchResponse.json()) as {
		match: {
			teamAssignments: Record<
				string,
				{
					team: 'BLUE' | 'RED'
					role: LolRole
					rating: number
				}
			>
		}
	}

	// 参加者チェック
	if (!matchData.match.teamAssignments[interaction.user.id]) {
		await interaction.reply({
			content: '試合参加者のみキャンセルできます。',
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// 試合キャンセルAPI呼び出し
	const cancelResponse = await apiClient.v1.guilds[':guildId'].matches[':matchId'].$delete({
		param: { guildId: interaction.guildId, matchId },
	})

	if (!cancelResponse.ok) {
		const error = (await cancelResponse.json()) as { message?: string }
		const message =
			error.message === 'Match is not in voting state' ? 'この試合は既に終了しています。' : 'キャンセルに失敗しました。'

		await interaction.reply({
			content: message,
			flags: MessageFlags.Ephemeral,
		})
		return
	}

	// API形式（大文字）をアプリ形式（小文字）に変換
	const teamAssignmentsLowerCase: TeamAssignments = Object.fromEntries(
		Object.entries(matchData.match.teamAssignments).map(([discordId, assignment]) => [
			discordId,
			{
				team: assignment.team.toLowerCase() as 'blue' | 'red',
				role: assignment.role,
				rating: assignment.rating,
			},
		]),
	)

	const embed = createMatchEmbed(teamAssignmentsLowerCase, 0, 0, 6, 'cancelled')

	await interaction.update({
		embeds: [embed],
		components: [],
	})

	await interaction.followUp({
		content: '試合がキャンセルされました。',
	})
}
