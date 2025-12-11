import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'
import { colors } from '@/config'

export const CAPACITY = 10

export const LOL_ROLES = ['top', 'jungle', 'mid', 'adc', 'support'] as const
export type LolRole = (typeof LOL_ROLES)[number]

export const ROLE_LABELS: Record<LolRole, string> = {
	top: 'トップ',
	jungle: 'ジャングル',
	mid: 'ミッド',
	adc: 'ADC',
	support: 'サポート',
}

export const ROLE_EMOJIS: Record<LolRole, string> = {
	top: '🛡️',
	jungle: '🌲',
	mid: '⚡',
	adc: '🏹',
	support: '💚',
}

export type Participant = {
	discordId: string
	mainRole?: LolRole | null
	subRole?: LolRole | null
}

export const parseCustomId = (customId: string) => {
	const parts = customId.split(':')
	return {
		command: parts[0],
		action: parts[1],
		recruitmentId: parts[2],
		originalMessageId: parts[3],
	}
}

export const formatRole = (role: LolRole | null | undefined): string => {
	if (!role) return '-'
	return `${ROLE_EMOJIS[role]} ${ROLE_LABELS[role]}`
}

export const createEmbed = (
	anonymous: boolean,
	participants: string[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const title = anonymous ? 'カスタム募集（匿名）' : 'カスタム募集'
	const embed = new EmbedBuilder().setTitle(title).setColor(colors.success)

	if (description) {
		embed.setDescription(description)
	}

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

export const createButtons = (recruitmentId: string, disabled: boolean) => {
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
		new ButtonBuilder()
			.setCustomId(`recruit:force_start:${recruitmentId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:close:${recruitmentId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createFullEmbed = (
	participants: string[],
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const fullDescription = description ? `${description}\n\n定員に達しました!` : '定員に達しました!'
	const embed = new EmbedBuilder().setTitle('募集完了!').setDescription(fullDescription).setColor(colors.success)

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

export const createClosedEmbed = (
	anonymous: boolean,
	participants: string[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const title = anonymous ? '募集終了（匿名）' : '募集終了'
	const closedDescription = description ? `${description}\n\nこの募集は終了しました。` : 'この募集は終了しました。'
	const embed = new EmbedBuilder().setTitle(title).setDescription(closedDescription).setColor(colors.error)

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

// ランク戦用Embed
export const createRankedEmbed = (
	participants: Participant[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const embed = new EmbedBuilder().setTitle('🏆 ランク戦募集').setColor(colors.primary)

	if (description) {
		embed.setDescription(description)
	}

	if (startTime) {
		embed.addFields({
			name: '開始時間',
			value: startTime,
			inline: true,
		})
	}

	const participantList =
		participants.length > 0
			? participants
					.map((p) => {
						const mainRole = formatRole(p.mainRole as LolRole | null)
						const subRole = formatRole(p.subRole as LolRole | null)
						return `<@${p.discordId}> - メイン: ${mainRole} / サブ: ${subRole}`
					})
					.join('\n')
			: 'なし'

	embed.addFields({
		name: `参加者 (${participants.length}/${capacity})`,
		value: participantList,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

// ランク戦用ボタン
export const createRankedButtons = (recruitmentId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:rank_join:${recruitmentId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:rank_leave:${recruitmentId}`)
			.setLabel('キャンセル')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:rank_force:${recruitmentId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:close:${recruitmentId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

// ロール選択セレクトメニュー
export const createRoleSelectMenu = (recruitmentId: string, type: 'main' | 'sub') => {
	const options = LOL_ROLES.map((role) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(ROLE_LABELS[role])
			.setValue(role)
			.setEmoji(ROLE_EMOJIS[role])
			.setDescription(type === 'main' ? 'メインロールとして選択' : 'サブロールとして選択'),
	)

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`recruit:select_${type}_role:${recruitmentId}`)
			.setPlaceholder(type === 'main' ? 'メインロールを選択' : 'サブロールを選択')
			.addOptions(options),
	)
}

// チーム振り分け用の型
export type TeamAssignment = {
	team: 'blue' | 'red'
	role: LolRole
	rating: number
}

export type TeamAssignments = Record<string, TeamAssignment>

export type RatingInfo = {
	discordId: string
	rating: number
	rank: string | null
	isPlacement: boolean | null
}

// チーム振り分け結果表示用Embed
export const createMatchEmbed = (
	teamAssignments: TeamAssignments,
	blueVotes: number,
	redVotes: number,
	votesRequired: number,
	status: 'voting' | 'confirmed' | 'cancelled' = 'voting',
) => {
	const blueTeam = Object.entries(teamAssignments)
		.filter(([, a]) => a.team === 'blue')
		.map(([discordId, a]) => ({ discordId, ...a }))
	const redTeam = Object.entries(teamAssignments)
		.filter(([, a]) => a.team === 'red')
		.map(([discordId, a]) => ({ discordId, ...a }))

	const blueTotal = blueTeam.reduce((sum, p) => sum + p.rating, 0)
	const redTotal = redTeam.reduce((sum, p) => sum + p.rating, 0)

	const formatTeamMember = (p: { discordId: string; role: LolRole; rating: number }) => {
		return `${ROLE_EMOJIS[p.role]} <@${p.discordId}> (${p.rating})`
	}

	const title =
		status === 'voting'
			? '🏆 ランク戦 - 勝敗投票'
			: status === 'confirmed'
				? '🏆 ランク戦 - 結果確定'
				: '🏆 ランク戦 - キャンセル'

	const color = status === 'voting' ? colors.primary : status === 'confirmed' ? colors.success : colors.error

	const embed = new EmbedBuilder().setTitle(title).setColor(color)

	embed.addFields(
		{
			name: `🔵 Blue Team (${blueTotal})`,
			value: blueTeam.map(formatTeamMember).join('\n') || 'なし',
			inline: true,
		},
		{
			name: `🔴 Red Team (${redTotal})`,
			value: redTeam.map(formatTeamMember).join('\n') || 'なし',
			inline: true,
		},
	)

	if (status === 'voting') {
		embed.addFields({
			name: '投票状況',
			value: `🔵 Blue勝利: ${blueVotes}票 / 🔴 Red勝利: ${redVotes}票\n(${votesRequired}票で確定)`,
			inline: false,
		})
	}

	return embed
}

// 投票ボタン
export const createVoteButtons = (matchId: string, disabled = false) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`recruit:vote_blue:${matchId}`)
			.setLabel('🔵 Blue勝利')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:vote_red:${matchId}`)
			.setLabel('🔴 Red勝利')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`recruit:vote_cancel:${matchId}`)
			.setLabel('キャンセル')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

// 結果確定後のEmbed
export const createMatchResultEmbed = (
	winningTeam: 'blue' | 'red',
	ratingChanges: Array<{
		discordId: string
		team: 'blue' | 'red'
		ratingBefore: number
		ratingAfter: number
		change: number
		rank: string
	}>,
) => {
	const blueChanges = ratingChanges.filter((r) => r.team === 'blue')
	const redChanges = ratingChanges.filter((r) => r.team === 'red')

	const formatChange = (r: (typeof ratingChanges)[0]) => {
		const changeStr = r.change >= 0 ? `+${r.change}` : `${r.change}`
		const winLose = r.team === winningTeam ? '🏆' : ''
		return `${winLose} <@${r.discordId}>: ${r.ratingBefore} → ${r.ratingAfter} (${changeStr})`
	}

	const embed = new EmbedBuilder()
		.setTitle(`🏆 試合結果 - ${winningTeam === 'blue' ? '🔵 Blue' : '🔴 Red'} チーム勝利！`)
		.setColor(winningTeam === 'blue' ? colors.blue : colors.red)
		.addFields(
			{
				name: '🔵 Blue Team',
				value: blueChanges.map(formatChange).join('\n') || 'なし',
				inline: true,
			},
			{
				name: '🔴 Red Team',
				value: redChanges.map(formatChange).join('\n') || 'なし',
				inline: true,
			},
		)

	return embed
}

// Eloに基づくチームバランス関数
export const balanceTeamsByElo = (
	participants: Array<{ discordId: string; mainRole?: LolRole | null; subRole?: LolRole | null; rating: number }>,
): TeamAssignments => {
	// レーティング順でソート
	const sorted = [...participants].sort((a, b) => b.rating - a.rating)

	// スネークドラフト方式で分配
	const blueTeam: typeof sorted = []
	const redTeam: typeof sorted = []

	sorted.forEach((p, i) => {
		// 0,3,4,7,8 → Blue, 1,2,5,6,9 → Red (スネーク)
		const round = Math.floor(i / 2)
		const isBlue = round % 2 === 0 ? i % 2 === 0 : i % 2 !== 0
		if (isBlue) {
			blueTeam.push(p)
		} else {
			redTeam.push(p)
		}
	})

	// ロールを割り当て
	const assignRoles = (team: typeof sorted): Array<{ discordId: string; role: LolRole; rating: number }> => {
		const assigned: Array<{ discordId: string; role: LolRole; rating: number }> = []
		const usedRoles = new Set<LolRole>()

		// まずメインロールで割り当て
		for (const p of team) {
			if (p.mainRole && !usedRoles.has(p.mainRole)) {
				assigned.push({ discordId: p.discordId, role: p.mainRole, rating: p.rating })
				usedRoles.add(p.mainRole)
			}
		}

		// サブロールで割り当て
		for (const p of team) {
			if (!assigned.find((a) => a.discordId === p.discordId)) {
				if (p.subRole && !usedRoles.has(p.subRole)) {
					assigned.push({ discordId: p.discordId, role: p.subRole, rating: p.rating })
					usedRoles.add(p.subRole)
				}
			}
		}

		// 残りは空いているロールを割り当て
		const remainingRoles = LOL_ROLES.filter((r) => !usedRoles.has(r))
		for (const p of team) {
			if (!assigned.find((a) => a.discordId === p.discordId)) {
				const role = remainingRoles.shift() || 'mid'
				assigned.push({ discordId: p.discordId, role, rating: p.rating })
			}
		}

		return assigned
	}

	const blueAssigned = assignRoles(blueTeam)
	const redAssigned = assignRoles(redTeam)

	const result: TeamAssignments = {}
	for (const p of blueAssigned) {
		result[p.discordId] = { team: 'blue', role: p.role, rating: p.rating }
	}
	for (const p of redAssigned) {
		result[p.discordId] = { team: 'red', role: p.role, rating: p.rating }
	}

	return result
}
