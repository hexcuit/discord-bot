import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'
import { COLORS } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'

const CONFIRM_TIMEOUT = 30000 // 30 seconds

export default {
	command: new SlashCommandBuilder()
		.setName('admin')
		.setDescription('サーバー管理者用コマンド')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommandGroup((group) =>
			group
				.setName('reset')
				.setDescription('データリセット')
				.addSubcommand((sub) => sub.setName('all').setDescription('サーバー全体のランク・マッチ履歴を初期化'))
				.addSubcommand((sub) =>
					sub
						.setName('user')
						.setDescription('特定ユーザーのランク・マッチ履歴を初期化')
						.addUserOption((opt) => opt.setName('target').setDescription('リセット対象のユーザー').setRequired(true)),
				),
		),

	execute: async (interaction) => {
		if (!interaction.guildId) {
			await interaction.reply({
				content: 'このコマンドはサーバー内でのみ使用できます。',
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const subcommandGroup = interaction.options.getSubcommandGroup()
		const subcommand = interaction.options.getSubcommand()

		if (subcommandGroup === 'reset') {
			switch (subcommand) {
				case 'all':
					await executeResetAll(interaction)
					break
				case 'user':
					await executeResetUser(interaction)
					break
			}
		}
	},
} satisfies Command

const executeResetAll = async (interaction: Parameters<Command['execute']>[0]) => {
	const guildId = interaction.guildId as string

	const confirmButton = new ButtonBuilder()
		.setCustomId('admin:reset:all:confirm')
		.setLabel('リセットする')
		.setStyle(ButtonStyle.Danger)

	const cancelButton = new ButtonBuilder()
		.setCustomId('admin:reset:all:cancel')
		.setLabel('キャンセル')
		.setStyle(ButtonStyle.Secondary)

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)

	const embed = new EmbedBuilder()
		.setTitle('サーバー全体のデータリセット')
		.setDescription(
			'**この操作は取り消せません！**\n\n' +
				'以下のデータがすべて削除されます：\n' +
				'- 全ユーザーのレート・ランク\n' +
				'- 全マッチ履歴\n' +
				'- 投票中のマッチ\n\n' +
				'本当にリセットしますか？',
		)
		.setColor(COLORS.error)

	const response = await interaction.reply({
		embeds: [embed],
		components: [row],
		flags: MessageFlags.Ephemeral,
	})

	try {
		const buttonInteraction = await response.awaitMessageComponent({
			componentType: ComponentType.Button,
			time: CONFIRM_TIMEOUT,
		})

		if (buttonInteraction.customId === 'admin:reset:all:confirm') {
			await buttonInteraction.deferUpdate()

			const res = await apiClient.v1.guilds[':guildId'].stats.$delete({
				param: { guildId },
			})

			if (!res.ok) {
				logger.error('ギルドリセット失敗:', res.status)
				await buttonInteraction.editReply({
					content: 'リセットに失敗しました。',
					embeds: [],
					components: [],
				})
				return
			}

			const data = await res.json()

			const resultEmbed = new EmbedBuilder()
				.setTitle('リセット完了')
				.setDescription(
					'サーバーのデータをリセットしました。\n\n' +
						`削除されたデータ：\n` +
						`- ユーザー統計: ${data.deletedCounts.userStats}件\n` +
						`- マッチ履歴: ${data.deletedCounts.matches}件\n` +
						`- マッチ参加記録: ${data.deletedCounts.matchPlayers}件\n` +
						`- 投票中マッチ: ${data.deletedCounts.pendingMatches}件`,
				)
				.setColor(COLORS.success)

			await buttonInteraction.editReply({
				embeds: [resultEmbed],
				components: [],
			})
		} else {
			await buttonInteraction.update({
				content: 'リセットをキャンセルしました。',
				embeds: [],
				components: [],
			})
		}
	} catch {
		await interaction.editReply({
			content: 'タイムアウトしました。リセットはキャンセルされました。',
			embeds: [],
			components: [],
		})
	}
}

const executeResetUser = async (interaction: Parameters<Command['execute']>[0]) => {
	const guildId = interaction.guildId as string
	const targetUser = interaction.options.getUser('target', true)

	const confirmButton = new ButtonBuilder()
		.setCustomId('admin:reset:user:confirm')
		.setLabel('リセットする')
		.setStyle(ButtonStyle.Danger)

	const cancelButton = new ButtonBuilder()
		.setCustomId('admin:reset:user:cancel')
		.setLabel('キャンセル')
		.setStyle(ButtonStyle.Secondary)

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)

	const embed = new EmbedBuilder()
		.setTitle('ユーザーデータリセット')
		.setDescription(
			'**この操作は取り消せません！**\n\n' +
				`<@${targetUser.id}> の以下のデータが削除されます：\n` +
				'- レート・ランク\n' +
				'- マッチ参加履歴\n\n' +
				'本当にリセットしますか？',
		)
		.setColor(COLORS.error)

	const response = await interaction.reply({
		embeds: [embed],
		components: [row],
		flags: MessageFlags.Ephemeral,
	})

	try {
		const buttonInteraction = await response.awaitMessageComponent({
			componentType: ComponentType.Button,
			time: CONFIRM_TIMEOUT,
		})

		if (buttonInteraction.customId === 'admin:reset:user:confirm') {
			await buttonInteraction.deferUpdate()

			const res = await apiClient.v1.guilds[':guildId'].users[':discordId'].stats.$delete({
				param: { guildId, discordId: targetUser.id },
			})

			if (!res.ok) {
				if (res.status === 404) {
					await buttonInteraction.editReply({
						content: `<@${targetUser.id}> のデータが見つかりませんでした。`,
						embeds: [],
						components: [],
					})
					return
				}
				logger.error('ユーザーリセット失敗:', res.status)
				await buttonInteraction.editReply({
					content: 'リセットに失敗しました。',
					embeds: [],
					components: [],
				})
				return
			}

			const data = await res.json()

			const resultEmbed = new EmbedBuilder()
				.setTitle('リセット完了')
				.setDescription(
					`<@${targetUser.id}> のデータをリセットしました。\n\n` +
						`削除されたデータ：\n` +
						`- ユーザー統計: ${data.deletedCounts.userStats}件\n` +
						`- マッチ参加記録: ${data.deletedCounts.matchPlayers}件`,
				)
				.setColor(COLORS.success)

			await buttonInteraction.editReply({
				embeds: [resultEmbed],
				components: [],
			})
		} else {
			await buttonInteraction.update({
				content: 'リセットをキャンセルしました。',
				embeds: [],
				components: [],
			})
		}
	} catch {
		await interaction.editReply({
			content: 'タイムアウトしました。リセットはキャンセルされました。',
			embeds: [],
			components: [],
		})
	}
}
