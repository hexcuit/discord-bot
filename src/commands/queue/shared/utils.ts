import type { RolePreference } from '@/constants'

import { ROLE_EMOJI } from '@/config'

import { ROLE_LABELS } from './constants'

// 短縮ロール名を展開
const expandRole = (short: string | undefined): RolePreference | undefined => {
	if (!short) return undefined
	const map: Record<string, RolePreference> = {
		TOP: 'TOP',
		JUN: 'JUNGLE',
		MID: 'MIDDLE',
		BOT: 'BOTTOM',
		SUP: 'SUPPORT',
		FIL: 'FILL',
	}
	return map[short] ?? (short as RolePreference)
}

export const parseCustomId = (customId: string) => {
	const parts = customId.split(':')

	// 短縮形式 (queue:sr:...) かどうか判定（action が 'sr' の場合）
	const isShortFormat = parts[1] === 'sr'

	// アクションを展開
	const action = isShortFormat ? 'select_role' : parts[1]

	// ロールタイプを展開 (m -> main, s -> sub)
	const roleType =
		parts[5] === 'm' ? 'main' : parts[5] === 's' ? 'sub' : (parts[5] as 'main' | 'sub' | undefined)

	// ロールを展開
	const role = isShortFormat ? expandRole(parts[6]) : (parts[6] as RolePreference | undefined)
	const mainRole = isShortFormat ? expandRole(parts[7]) : (parts[7] as RolePreference | undefined)

	return {
		command: parts[0],
		action,
		guildId: parts[2],
		queueId: parts[3],
		originalMessageId: parts[4],
		roleType,
		role,
		mainRole,
	}
}

export const formatRole = (role: RolePreference | null | undefined): string => {
	if (!role) return '-'
	return `${ROLE_EMOJI[role]} ${ROLE_LABELS[role]}`
}
