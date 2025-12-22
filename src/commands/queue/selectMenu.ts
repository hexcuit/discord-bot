import { type CacheType, MessageFlags, type StringSelectMenuInteraction } from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { parseCustomId } from './shared/utils'

export const handleSelectMenu = async (interaction: StringSelectMenuInteraction<CacheType>) => {
	const { action, queueId } = parseCustomId(interaction.customId)
	const selectedValue = interaction.values[0] as LolRole

	if (!queueId || !selectedValue) {
		return
	}

	try {
		if (action === 'select_main_role' || action === 'select_sub_role') {
			const roleType = action === 'select_main_role' ? 'main' : 'sub'

			// APIでロールを更新
			await apiClient.v1.queues[':id'].players[':discordId'].$patch({
				param: {
					id: queueId,
					discordId: interaction.user.id,
				},
				json: {
					mainRole: roleType === 'main' ? selectedValue : undefined,
					subRole: roleType === 'sub' ? selectedValue : undefined,
				},
			})

			// 確認メッセージなしで選択を反映（ドロップダウン自体に選択が表示される）
			await interaction.deferUpdate()
		}
	} catch (error) {
		logger.error('セレクトメニュー処理エラー:', error)
		await interaction.reply({
			content: '処理中にエラーが発生しました。',
			flags: MessageFlags.Ephemeral,
		})
	}
}
