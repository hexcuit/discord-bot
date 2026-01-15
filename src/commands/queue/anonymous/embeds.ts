import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { COLORS } from '@/config'

import { CAPACITY } from '../shared/constants'

export const createEmbed = (participantCount: number, capacity: number, creatorId: string) => {
	const embed = new EmbedBuilder().setTitle('カスタム募集（匿名）').setColor(COLORS.success)

	embed.addFields({
		name: '参加者',
		value: `${participantCount}/${capacity}人`,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

export const createButtons = (guildId: string, queueId: string, disabled: boolean) => {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`queue:anon_join:${guildId}:${queueId}`)
			.setLabel('参加')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:anon_leave:${guildId}:${queueId}`)
			.setLabel('退出')
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:anon_force:${guildId}:${queueId}`)
			.setLabel('強制開始')
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(`queue:anon_close:${guildId}:${queueId}`)
			.setLabel('募集終了')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	)
}

export const createFullEmbed = (participantCount: number, creatorId: string) => {
	const embed = new EmbedBuilder()
		.setTitle('募集完了!')
		.setDescription('定員に達しました!')
		.setColor(COLORS.success)

	embed.addFields({
		name: '参加者',
		value: `${participantCount}/${CAPACITY}人`,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}

export const createClosedEmbed = (
	participantCount: number,
	capacity: number,
	creatorId: string,
) => {
	const embed = new EmbedBuilder()
		.setTitle('募集終了（匿名）')
		.setDescription('この募集は終了しました。')
		.setColor(COLORS.error)

	embed.addFields({
		name: '参加者',
		value: `${participantCount}/${capacity}人`,
		inline: false,
	})

	embed.setFooter({ text: `主催: ${creatorId}` })

	return embed
}
