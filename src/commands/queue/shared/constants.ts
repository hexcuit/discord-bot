import type { RolePreference } from '@/constants'

export const CAPACITY = 10

export const INITIAL_RATING = 1500

export const ROLE_LABELS: Record<RolePreference, string> = {
	TOP: 'トップ',
	JUNGLE: 'ジャングル',
	MIDDLE: 'ミッド',
	BOTTOM: 'ボット',
	SUPPORT: 'サポート',
	FILL: 'どこでも',
}
