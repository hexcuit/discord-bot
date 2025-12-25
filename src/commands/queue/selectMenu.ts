import { type CacheType, MessageFlags, type StringSelectMenuInteraction } from 'discord.js'
import type { LolRole } from '@/constants'
import { logger } from '@/lib/logger'
import { pendingRoleSelections } from './rank/button'
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
			const pendingKey = `${queueId}:${interaction.user.id}`

			// Only handle pending role selection (before join is confirmed)
			// To change roles after joining, user must leave and rejoin
			const pendingRoles = pendingRoleSelections.get(pendingKey)

			if (pendingRoles) {
				// Check if same role is already selected for the other type
				const otherRole = roleType === 'main' ? pendingRoles.subRole : pendingRoles.mainRole
				if (otherRole === selectedValue) {
					await interaction.reply({
						content: 'メインロールとサブロールに同じロールは選択できません。',
						flags: MessageFlags.Ephemeral,
					})
					return
				}

				if (roleType === 'main') {
					pendingRoles.mainRole = selectedValue
				} else {
					pendingRoles.subRole = selectedValue
				}
				pendingRoleSelections.set(pendingKey, pendingRoles)
			}

			await interaction.deferUpdate()
		}
	} catch (error) {
		logger.error('Select menu error:', error)
		await interaction.reply({
			content: '処理中にエラーが発生しました。',
			flags: MessageFlags.Ephemeral,
		})
	}
}
