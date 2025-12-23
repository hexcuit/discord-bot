import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { COLORS } from '@/config'
import { CAPACITY } from './constants'

export const createEmbed = (anonymous: boolean, participants: string[], capacity: number, creatorId: string) => {
	const title = anonymous ? 'カスタム募集（匿名）' : 'カスタム募集'
	const embed = new EmbedBuilder().setTitle(title).setColor(COLORS.success)

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

export const createButtons = (queueId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:join:${queueId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:leave:${queueId}`)
			.setLabel('退出')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:force_start:${queueId}`)
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
