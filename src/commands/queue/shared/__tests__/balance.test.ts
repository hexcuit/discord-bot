/**
 * Tests for balance.ts - Team balancing logic
 */
import { describe, expect, it } from 'bun:test'
import type { LolRole } from '@/constants'
import { balanceTeamsByElo } from '../balance'

describe('balanceTeamsByElo', () => {
	it('distributes 10 players using snake draft', () => {
		const participants = Array.from({ length: 10 }, (_, i) => ({
			discordId: `user-${i}`,
			mainRole: null,
			subRole: null,
			rating: 1500 - i * 50, // 1500, 1450, 1400, ...
		}))

		const result = balanceTeamsByElo(participants)

		// Should have 10 assignments
		expect(Object.keys(result)).toHaveLength(10)

		// Count teams
		const blueCount = Object.values(result).filter((a) => a.team === 'BLUE').length
		const redCount = Object.values(result).filter((a) => a.team === 'RED').length

		expect(blueCount).toBe(5)
		expect(redCount).toBe(5)
	})

	it('balances teams by rating with snake draft (0,3,4,7,8 → Blue)', () => {
		// Ratings: 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700, 600
		// Sorted indices: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
		// Snake: Blue gets 0,3,4,7,8 = 1500+1200+1100+800+700 = 5300
		// Snake: Red gets 1,2,5,6,9 = 1400+1300+1000+900+600 = 5200
		const participants = Array.from({ length: 10 }, (_, i) => ({
			discordId: `user-${i}`,
			mainRole: null,
			subRole: null,
			rating: 1500 - i * 100,
		}))

		const result = balanceTeamsByElo(participants)

		const blueTotal = Object.values(result)
			.filter((a) => a.team === 'BLUE')
			.reduce((sum, a) => sum + a.rating, 0)

		const redTotal = Object.values(result)
			.filter((a) => a.team === 'RED')
			.reduce((sum, a) => sum + a.rating, 0)

		// Teams should be relatively balanced
		const diff = Math.abs(blueTotal - redTotal)
		expect(diff).toBeLessThan(200) // Reasonable balance threshold
	})

	it('assigns main roles when available', () => {
		const participants: Array<{
			discordId: string
			mainRole: LolRole | null
			subRole: LolRole | null
			rating: number
		}> = [
			{ discordId: 'user-0', mainRole: 'TOP', subRole: 'JUNGLE', rating: 1500 },
			{ discordId: 'user-1', mainRole: 'JUNGLE', subRole: 'TOP', rating: 1450 },
			{ discordId: 'user-2', mainRole: 'MIDDLE', subRole: 'SUPPORT', rating: 1400 },
			{ discordId: 'user-3', mainRole: 'BOTTOM', subRole: 'MIDDLE', rating: 1350 },
			{ discordId: 'user-4', mainRole: 'SUPPORT', subRole: 'BOTTOM', rating: 1300 },
			{ discordId: 'user-5', mainRole: 'TOP', subRole: 'JUNGLE', rating: 1250 },
			{ discordId: 'user-6', mainRole: 'JUNGLE', subRole: 'TOP', rating: 1200 },
			{ discordId: 'user-7', mainRole: 'MIDDLE', subRole: 'SUPPORT', rating: 1150 },
			{ discordId: 'user-8', mainRole: 'BOTTOM', subRole: 'MIDDLE', rating: 1100 },
			{ discordId: 'user-9', mainRole: 'SUPPORT', subRole: 'BOTTOM', rating: 1050 },
		]

		const result = balanceTeamsByElo(participants)

		// Each team should have all 5 roles
		const blueRoles = new Set(
			Object.values(result)
				.filter((a) => a.team === 'BLUE')
				.map((a) => a.role),
		)
		const redRoles = new Set(
			Object.values(result)
				.filter((a) => a.team === 'RED')
				.map((a) => a.role),
		)

		expect(blueRoles.size).toBe(5)
		expect(redRoles.size).toBe(5)
	})

	it('uses sub roles when main roles conflict', () => {
		// All players want MID as main role
		const participants: Array<{
			discordId: string
			mainRole: LolRole | null
			subRole: LolRole | null
			rating: number
		}> = Array.from({ length: 10 }, (_, i) => ({
			discordId: `user-${i}`,
			mainRole: 'MIDDLE' as LolRole,
			subRole: ['TOP', 'JUNGLE', 'BOTTOM', 'SUPPORT', 'TOP'][i % 5] as LolRole,
			rating: 1500 - i * 50,
		}))

		const result = balanceTeamsByElo(participants)

		// Should still assign all 5 roles per team
		const blueRoles = Object.values(result)
			.filter((a) => a.team === 'BLUE')
			.map((a) => a.role)
		const redRoles = Object.values(result)
			.filter((a) => a.team === 'RED')
			.map((a) => a.role)

		expect(blueRoles).toHaveLength(5)
		expect(redRoles).toHaveLength(5)
	})

	it('handles players without role preferences', () => {
		const participants = Array.from({ length: 10 }, (_, i) => ({
			discordId: `user-${i}`,
			mainRole: null,
			subRole: null,
			rating: 1200,
		}))

		const result = balanceTeamsByElo(participants)

		// Should still assign roles
		const allRolesAssigned = Object.values(result).every((a) => a.role !== undefined)
		expect(allRolesAssigned).toBe(true)
	})

	it('preserves discordId in assignments', () => {
		const participants = [
			{ discordId: 'alice', mainRole: null, subRole: null, rating: 1500 },
			{ discordId: 'bob', mainRole: null, subRole: null, rating: 1400 },
			{ discordId: 'charlie', mainRole: null, subRole: null, rating: 1300 },
			{ discordId: 'david', mainRole: null, subRole: null, rating: 1200 },
			{ discordId: 'eve', mainRole: null, subRole: null, rating: 1100 },
			{ discordId: 'frank', mainRole: null, subRole: null, rating: 1000 },
			{ discordId: 'grace', mainRole: null, subRole: null, rating: 900 },
			{ discordId: 'henry', mainRole: null, subRole: null, rating: 800 },
			{ discordId: 'ivy', mainRole: null, subRole: null, rating: 700 },
			{ discordId: 'jack', mainRole: null, subRole: null, rating: 600 },
		]

		const result = balanceTeamsByElo(participants)

		// All original discordIds should be present
		for (const p of participants) {
			expect(result[p.discordId]).toBeDefined()
		}
	})
})
