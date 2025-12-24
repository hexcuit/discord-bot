import { ROLE_EMOJI } from '@/config'
import type { LolRole } from '@/constants'
import { ROLE_LABELS } from './constants'

export const parseCustomId = (customId: string) => {
	const parts = customId.split(':')
	return {
		command: parts[0],
		action: parts[1],
		guildId: parts[2],
		queueId: parts[3],
		originalMessageId: parts[4],
	}
}

export const formatRole = (role: LolRole | null | undefined): string => {
	if (!role) return '-'
	return `${ROLE_EMOJI[role]} ${ROLE_LABELS[role]}`
}
