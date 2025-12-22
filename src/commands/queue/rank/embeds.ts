import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'
import { COLORS, ROLE_EMOJI } from '@/config'
import { LOL_ROLES, type LolRole, type LolTeam } from '@/constants'
import { ROLE_LABELS } from '../shared/constants'
import type { Participant, TeamAssignments } from '../shared/types'
import { formatRole } from '../shared/utils'

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

export const createRankedButtons = (queueId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:rank_join:${queueId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:rank_leave:${queueId}`)
			.setLabel('退出')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:rank_force:${queueId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:close:${queueId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createRoleSelectMenu = (queueId: string, type: 'main' | 'sub') => {
	const options = LOL_ROLES.map((role) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(ROLE_LABELS[role])
			.setValue(role)
			.setEmoji(ROLE_EMOJI[role])
			.setDescription(type === 'main' ? 'メインロールとして選択' : 'サブロールとして選択'),
	)

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(`queue:select_${type}_role:${queueId}`)
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
		.filter(([, a]) => a.team === 'BLUE')
		.map(([discordId, a]) => ({ discordId, ...a }))
	const redTeam = Object.entries(teamAssignments)
		.filter(([, a]) => a.team === 'RED')
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
			.setCustomId(`queue:vote_cancel:${matchId}`)
			.setLabel('キャンセル')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createMatchResultEmbed = (
	winningTeam: LolTeam,
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

	const formatChange = (r: (typeof ratingChanges)[0]) => {
		const changeStr = r.change >= 0 ? `+${r.change}` : `${r.change}`
		const winLose = r.team === winningTeam ? '🏆' : ''
		return `${winLose} <@${r.discordId}>: ${r.ratingBefore} → ${r.ratingAfter} (${changeStr})`
	}

	const embed = new EmbedBuilder()
		.setTitle(`🏆 試合結果 - ${winningTeam === 'BLUE' ? '🔵 Blue' : '🔴 Red'} チーム勝利！`)
		.setColor(winningTeam === 'BLUE' ? COLORS.blue : COLORS.red)
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
