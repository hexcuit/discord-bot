import { type CacheType, MessageFlags, type StringSelectMenuInteraction } from 'discord.js'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { type LolRole, parseCustomId, ROLE_EMOJIS, ROLE_LABELS } from './shared'

export const handleSelectMenu = async (interaction: StringSelectMenuInteraction<CacheType>) => {
	const { action, recruitmentId } = parseCustomId(interaction.customId)
	const selectedValue = interaction.values[0] as LolRole

	if (!recruitmentId || !selectedValue) {
		return
	}

	try {
		if (action === 'select_main_role' || action === 'select_sub_role') {
			const roleType = action === 'select_main_role' ? 'main' : 'sub'

			// APIでロールを更新
			await apiClient.recruit['update-role'].$post({
				json: {
					recruitmentId,
					discordId: interaction.user.id,
					mainRole: roleType === 'main' ? selectedValue : undefined,
					subRole: roleType === 'sub' ? selectedValue : undefined,
				},
			})

			// まだ参加していない場合はエラーにならないように、選択を確認するだけ
			const roleLabel = ROLE_LABELS[selectedValue]
			const emoji = ROLE_EMOJIS[selectedValue]

			await interaction.reply({
				content: `${emoji} ${roleType === 'main' ? 'メインロール' : 'サブロール'}を **${roleLabel}** に設定しました。`,
				flags: MessageFlags.Ephemeral,
			})
		}
	} catch (error) {
		logger.error('セレクトメニュー処理エラー:', error)
		await interaction.reply({
			content: '処理中にエラーが発生しました。',
			flags: MessageFlags.Ephemeral,
		})
	}
}
