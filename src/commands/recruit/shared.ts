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
