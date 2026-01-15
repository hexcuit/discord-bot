import type { LolRole, LolTeam, RolePreference } from '@/constants'

export type Participant = {
	discordId: string
	mainRole: RolePreference
	subRole: RolePreference
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
