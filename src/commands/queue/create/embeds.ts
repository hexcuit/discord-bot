import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { COLORS } from '@/config'
import { CAPACITY } from '../shared/constants'

export const createEmbed = (participants: string[], capacity: number, creatorId: string) => {
	const embed = new EmbedBuilder().setTitle('カスタム募集').setColor(COLORS.success)

	const participantList = participants.length > 0 ? participants.map((id) => `<@${id}>`).join('\n') : 'なし'

	embed.addFields({
		name: `参加者 (${participants.length}/${capacity})`,
		value: participantList,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

export const createButtons = (guildId: string, queueId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:create_join:${guildId}:${queueId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:create_leave:${guildId}:${queueId}`)
			.setLabel('退出')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:create_force:${guildId}:${queueId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:create_close:${guildId}:${queueId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createFullEmbed = (participants: string[], creatorId: string) => {
	const embed = new EmbedBuilder().setTitle('募集完了!').setDescription('定員に達しました!').setColor(COLORS.success)

	const mentions = participants.map((id) => `<@${id}>`).join('\n')
	embed.addFields({
		name: `参加者 (${participants.length}/${CAPACITY})`,
		value: mentions,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

export const createClosedEmbed = (participants: string[], capacity: number, creatorId: string) => {
	const embed = new EmbedBuilder()
		.setTitle('募集終了')
		.setDescription('この募集は終了しました。')
		.setColor(COLORS.error)

	const participantList = participants.length > 0 ? participants.map((id) => `<@${id}>`).join('\n') : 'なし'
	embed.addFields({
		name: `参加者 (${participants.length}/${capacity})`,
		value: participantList,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}
