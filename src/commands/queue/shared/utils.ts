import type { RolePreference } from '@/constants'

import { ROLE_EMOJI } from '@/config'

import { ROLE_LABELS } from './constants'

export const parseCustomId = (customId: string) => {
	const parts = customId.split(':')
	return {
		command: parts[0],
		action: parts[1],
		guildId: parts[2],
		queueId: parts[3],
		originalMessageId: parts[4],
		// ロール選択ボタン用の追加パラメータ
		roleType: parts[5] as 'main' | 'sub' | undefined,
		role: parts[6] as RolePreference | undefined,
		mainRole: parts[7] as RolePreference | undefined, // sub選択時のみ
	}
}

export const formatRole = (role: RolePreference | null | undefined): string => {
	if (!role) return '-'
	return `${ROLE_EMOJI[role]} ${ROLE_LABELS[role]}`
}
