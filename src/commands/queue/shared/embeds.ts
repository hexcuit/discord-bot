import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'
import { COLORS, ROLE_EMOJI } from '@/config'
import { LOL_ROLES, type LolRole } from '@/constants'
import { CAPACITY, ROLE_LABELS } from './constants'
import type { Participant, TeamAssignments } from './types'
import { formatRole } from './utils'

export const createEmbed = (
	anonymous: boolean,
	participants: string[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const title = anonymous ? 'カスタム募集（匿名）' : 'カスタム募集'
	const embed = new EmbedBuilder().setTitle(title).setColor(COLORS.success)

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
	const embed = new EmbedBuilder().setTitle('募集完了!').setDescription(fullDescription).setColor(COLORS.success)

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
	const embed = new EmbedBuilder().setTitle(title).setDescription(closedDescription).setColor(COLORS.error)

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

export const createRankedEmbed = (
	participants: Participant[],
	capacity: number,
	creatorId: string,
	startTime?: string | null,
	description?: string | null,
) => {
	const embed = new EmbedBuilder().setTitle('🏆 ランク戦募集').setColor(COLORS.primary)

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

export const createRoleSelectMenu = (recruitmentId: string, type: 'main' | 'sub') => {
	const options = LOL_ROLES.map((role) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(ROLE_LABELS[role])
			.setValue(role)
			.setEmoji(ROLE_EMOJI[role])
			.setDescription(type === 'main' ? 'メインロールとして選択' : 'サブロールとして選択'),
	)

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`recruit:select_${type}_role:${recruitmentId}`)
			.setPlaceholder(type === 'main' ? 'メインロールを選択' : 'サブロールを選択')
			.addOptions(options),
	)
}

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
		return `${ROLE_EMOJI[p.role]} <@${p.discordId}> (${p.rating})`
	}

	const title =
		status === 'voting'
			? '🏆 ランク戦 - 勝敗投票'
			: status === 'confirmed'
				? '🏆 ランク戦 - 結果確定'
				: '🏆 ランク戦 - キャンセル'

	const color = status === 'voting' ? COLORS.primary : status === 'confirmed' ? COLORS.success : COLORS.error

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
		.setColor(winningTeam === 'blue' ? COLORS.blue : COLORS.red)
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
