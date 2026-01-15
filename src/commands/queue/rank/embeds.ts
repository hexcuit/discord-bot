import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'

import { COLORS, ROLE_EMOJI } from '@/config'
import {
	LOL_ROLES,
	type LolRole,
	type LolTeam,
	type MatchResult,
	ROLE_PREFERENCES,
	type RolePreference,
} from '@/constants'

import type { Participant, TeamAssignments } from '../shared/types'

import { ROLE_LABELS } from '../shared/constants'
import { formatRole } from '../shared/utils'

export const createRankedEmbed = (
	participants: Participant[],
	capacity: number,
	creatorId: string,
) => {
	const embed = new EmbedBuilder().setTitle('🏆 ランク戦募集').setColor(COLORS.primary)

	const participantList =
		participants.length > 0
			? participants
					.map((p) => {
						const mainRole = formatRole(p.mainRole)
						const subRole = formatRole(p.subRole)
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

export const createRankedButtons = (guildId: string, queueId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:rank_join:${guildId}:${queueId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:rank_leave:${guildId}:${queueId}`)
			.setLabel('退出')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:rank_force:${guildId}:${queueId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:rank_close:${guildId}:${queueId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

const createRoleSelectMenu = (guildId: string, queueId: string, type: 'main' | 'sub') => {
	const options = LOL_ROLES.map((role) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(ROLE_LABELS[role])
			.setValue(role)
			.setEmoji(ROLE_EMOJI[role])
			.setDescription(type === 'main' ? 'メインロールとして選択' : 'サブロールとして選択'),
	)

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`queue:select_${type}_role:${guildId}:${queueId}`)
			.setPlaceholder(type === 'main' ? 'メインロールを選択' : 'サブロールを選択')
			.addOptions(options),
	)
}

/**
 * ロール選択ボタンを作成
 * @param guildId - ギルドID
 * @param queueId - キューID
 * @param originalMessageId - 元のメッセージID
 * @param type - 'main' | 'sub' 選択中のロールタイプ
 * @param selectedMainRole - 選択済みのメインロール（サブ選択時に無効化用）
 */
export const createRoleButtons = (
	guildId: string,
	queueId: string,
	originalMessageId: string,
	type: 'main' | 'sub',
	selectedMainRole?: RolePreference,
) => {
	const buttons = ROLE_PREFERENCES.map((role) => {
		const isDisabled = type === 'sub' && role === selectedMainRole
		// sub選択時はmainRoleもcustomIdに含める
		const customId =
			type === 'sub'
				? `queue:select_role:${guildId}:${queueId}:${originalMessageId}:${type}:${role}:${selectedMainRole}`
				: `queue:select_role:${guildId}:${queueId}:${originalMessageId}:${type}:${role}`
		return new ButtonBuilder()
			.setCustomId(customId)
			.setLabel(ROLE_LABELS[role])
			.setEmoji(ROLE_EMOJI[role])
			.setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
			.setDisabled(isDisabled)
	})

	// 6ボタンを2行に分割 (3+3)
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 3)),
		new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(3, 6)),
	]
}

export const createMatchEmbed = (
	teamAssignments: TeamAssignments,
	blueVotes: number,
	redVotes: number,
	drawVotes: number,
	votesRequired: number,
	status: 'voting' | 'confirmed' | 'cancelled' = 'voting',
) => {
	const blueTeam = Object.entries(teamAssignments)
		.filter(([, a]) => a.team === 'BLUE')
		.map(([discordId, a]) => ({ discordId, ...a }))
		.sort((a, b) => LOL_ROLES.indexOf(a.role) - LOL_ROLES.indexOf(b.role))
	const redTeam = Object.entries(teamAssignments)
		.filter(([, a]) => a.team === 'RED')
		.map(([discordId, a]) => ({ discordId, ...a }))
		.sort((a, b) => LOL_ROLES.indexOf(a.role) - LOL_ROLES.indexOf(b.role))

	const blueTotal = blueTeam.reduce((sum, p) => sum + p.rating, 0)
	const redTotal = redTeam.reduce((sum, p) => sum + p.rating, 0)

	const formatTeamMember = (p: { discordId: string; role: LolRole; rating: number }) => {
		return `${ROLE_EMOJI[p.role]} <@${p.discordId}> (${p.rating})`
	}

	const title =
		status === 'voting'
			? '🏆 ランク戦 - 勝敗投票'
			: status === 'confirmed'
				? '🏆 ランク戦 - 結果確定'
				: '🏆 ランク戦 - キャンセル'

	const color =
		status === 'voting' ? COLORS.primary : status === 'confirmed' ? COLORS.success : COLORS.error

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
		const totalVotes = blueVotes + redVotes + drawVotes
		embed.addFields({
			name: `投票状況 (${totalVotes}/10)`,
			value: `🔵 Blue勝利: ${blueVotes}票\n🔴 Red勝利: ${redVotes}票\n🤝 引き分け: ${drawVotes}票\n(${votesRequired}票で早期確定 / 全員投票で最多得票確定)`,
			inline: false,
		})
	}

	return embed
}

export const createVoteButtons = (matchId: string, disabled = false) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:vote_blue:${matchId}`)
			.setLabel('🔵 Blue勝利')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:vote_red:${matchId}`)
			.setLabel('🔴 Red勝利')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:vote_draw:${matchId}`)
			.setLabel('🤝 引き分け')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createRankedClosedEmbed = (
	participants: Participant[],
	capacity: number,
	creatorId: string,
) => {
	const embed = new EmbedBuilder()
		.setTitle('🏆 ランク戦募集終了')
		.setDescription('この募集は終了しました。')
		.setColor(COLORS.error)

	const participantList =
		participants.length > 0
			? participants
					.map((p) => {
						const mainRole = formatRole(p.mainRole)
						const subRole = formatRole(p.subRole)
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

export const createMatchResultEmbed = (
	winningTeam: MatchResult,
	ratingChanges: Array<{
		discordId: string
		team: LolTeam
		ratingBefore: number
		ratingAfter: number
		change: number
		rank: string
	}>,
) => {
	const blueChanges = ratingChanges.filter((r) => r.team === 'BLUE')
	const redChanges = ratingChanges.filter((r) => r.team === 'RED')

	const isDraw = winningTeam === 'DRAW'

	const formatChange = (r: (typeof ratingChanges)[0]) => {
		const changeStr = r.change >= 0 ? `+${r.change}` : `${r.change}`
		const winLose = isDraw ? '' : r.team === winningTeam ? '🏆' : ''
		return `${winLose} <@${r.discordId}>: ${r.ratingBefore} → ${r.ratingAfter} (${changeStr})`
	}

	const title = isDraw
		? '🏆 試合結果 - 引き分け'
		: `🏆 試合結果 - ${winningTeam === 'BLUE' ? '🔵 Blue' : '🔴 Red'} チーム勝利！`

	const color = isDraw ? COLORS.primary : winningTeam === 'BLUE' ? COLORS.blue : COLORS.red

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(color)
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

	if (isDraw) {
		embed.setFooter({ text: 'レーティング変動はありません' })
	}

	return embed
}
