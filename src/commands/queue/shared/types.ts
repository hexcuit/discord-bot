import type { LolRole, LolTeam } from '@/constants'

export type Participant = {
	discordId: string
	mainRole?: LolRole | null
	subRole?: LolRole | null
}

export type TeamAssignment = {
	team: LolTeam
	role: LolRole
	rating: number
}

export type TeamAssignments = Record<string, TeamAssignment>

export type RatingInfo = {
	discordId: string
	rating: number
	rank: string | null
	isPlacement: boolean | null
}
