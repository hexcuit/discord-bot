import { type ChatInputCommandInteraction, EmbedBuilder, type GuildMember } from 'discord.js'
import { COLORS, RANK_EMOJI } from '@/config'
import { logger } from '@/lib/logger'
import { apiClient } from '@/utils/api-client'
import { getFilteredMembers } from './shared'

// 型定義
interface RankInfo {
	discordId: string
	tier: string
	division: string | null
}

interface TeamMemberWithRank {
	member: GuildMember
	rank: number
	tier: string
	division: string
}

interface TeamWithRank {
	members: TeamMemberWithRank[]
	totalRankPoints: number
}

interface TeamCombination {
	blueTeam: TeamWithRank
	redTeam: TeamWithRank
	powerDifference: number
	combinationId: number
}

// 定数
const DIVISION_BONUS_POINTS = 5
const MAX_POWER_DIFFERENCE = 10

const ERROR_MESSAGES = {
	API_ERROR: '登録中にエラーが発生しました。後でもう一度お試しください。',
	RANK_DATA_FETCH_FAILED: 'ランクデータの取得に失敗しました。',
	COMBINATION_SELECTION_ERROR: 'チーム組み合わせの選択でエラーが発生しました。',
} as const

// ユーティリティ関数
const calculateRankValue = (tier: string, division: string): number => {
	const tierValues: Record<string, number> = {
		UNRANKED: 5,
		IRON: 10,
		BRONZE: 30,
		SILVER: 50,
		GOLD: 70,
		PLATINUM: 90,
		EMERALD: 110,
		DIAMOND: 130,
		MASTER: 150,
		GRANDMASTER: 170,
		CHALLENGER: 190,
	}

	const baseValue = tierValues[tier] || 0

	if (division && ['IV', 'III', 'II', 'I'].includes(division)) {
		const divisionBonus = ['IV', 'III', 'II', 'I'].indexOf(division)
		return baseValue + divisionBonus * DIVISION_BONUS_POINTS
	}

	return baseValue
}

const getRankEmoji = (tier: string): string => {
	return RANK_EMOJI[tier as keyof typeof RANK_EMOJI] || ''
}

const fetchRankData = async (
	discordIds: string[],
): Promise<{ success: boolean; ranks?: RankInfo[]; error?: string }> => {
	try {
		const response = await apiClient.v1.ranks.$get({
			query: { id: discordIds },
		})

		if (!response.ok) {
			logger.error('APIリクエスト失敗:', response.status, response.statusText)
			return { success: false, error: ERROR_MESSAGES.API_ERROR }
		}

		const data = await response.json()
		return { success: true, ranks: data.ranks }
	} catch (error) {
		logger.error('API呼び出しエラー:', error)
		return { success: false, error: ERROR_MESSAGES.API_ERROR }
	}
}

const formatTeamMemberFieldWithRank = (teamMember: TeamMemberWithRank) => {
	const divisionText = teamMember.division ? ` ${teamMember.division}` : ''
	const rankText = `${teamMember.rank}ポイント`

	return {
		name: '',
		value: `${getRankEmoji(teamMember.tier)}${divisionText} <@${teamMember.member.id}> ・ ${rankText}`,
		inline: false,
	}
}

function generateAllTeamCombinations(members: GuildMember[], rankData: RankInfo[]): TeamCombination[] {
	const membersWithRank: TeamMemberWithRank[] = members.map((member) => {
		const rankInfo = rankData.find((r) => r.discordId === member.id)
		const tier = rankInfo?.tier || 'UNRANKED'
		const division = rankInfo?.division || ''
		return {
			member,
			rank: calculateRankValue(tier, division),
			tier,
			division,
		}
	})

	const totalMembers = membersWithRank.length
	const teamSize = Math.floor(totalMembers / 2)
	const possibleCombinations: TeamCombination[] = []

	function generateMemberCombinations(
		availableMembers: TeamMemberWithRank[],
		requiredSize: number,
	): TeamMemberWithRank[][] {
		if (requiredSize === 0) return [[]]
		if (availableMembers.length === 0) return []

		const firstMember = availableMembers[0]
		if (!firstMember) return []

		const remainingMembers = availableMembers.slice(1)
		const combinationsWithFirst = generateMemberCombinations(remainingMembers, requiredSize - 1).map((combination) => [
			firstMember,
			...combination,
		])
		const combinationsWithoutFirst = generateMemberCombinations(remainingMembers, requiredSize)

		return [...combinationsWithFirst, ...combinationsWithoutFirst]
	}

	const blueTeamCombinations = generateMemberCombinations(membersWithRank, teamSize)

	blueTeamCombinations.forEach((blueTeamMembers, index) => {
		const redTeamMembers = membersWithRank.filter(
			(member) => !blueTeamMembers.some((blueMember) => blueMember.member.id === member.member.id),
		)

		const blueTeam: TeamWithRank = {
			members: blueTeamMembers,
			totalRankPoints: blueTeamMembers.reduce((sum, member) => sum + member.rank, 0),
		}

		const redTeam: TeamWithRank = {
			members: redTeamMembers,
			totalRankPoints: redTeamMembers.reduce((sum, member) => sum + member.rank, 0),
		}

		const powerDifference = Math.abs(blueTeam.totalRankPoints - redTeam.totalRankPoints)

		possibleCombinations.push({
			blueTeam,
			redTeam,
			powerDifference,
			combinationId: index + 1,
		})
	})

	return possibleCombinations
}

function createBalanceTeamEmbeds(
	blueTeam: TeamWithRank,
	redTeam: TeamWithRank,
	options?: {
		combinationInfo?: { current: number; total: number }
		excludedMembers?: GuildMember[]
	},
): EmbedBuilder[] {
	const blueTeamEmbed = new EmbedBuilder()
		.setTitle('Blue Team')
		.addFields(blueTeam.members.map((member) => formatTeamMemberFieldWithRank(member)))
		.setColor(COLORS.blue)

	const redTeamEmbed = new EmbedBuilder()
		.setTitle('Red Team')
		.addFields(redTeam.members.map((member) => formatTeamMemberFieldWithRank(member)))
		.setColor(COLORS.red)

	const powerDifference = Math.abs(blueTeam.totalRankPoints - redTeam.totalRankPoints)

	const combinationInfo = options?.combinationInfo
	const combinationSummary = combinationInfo ? `${combinationInfo.current}/${combinationInfo.total}` : 'N/A'
	const excludedMembers = options?.excludedMembers ?? []
	const teamInfoEmbed = new EmbedBuilder().setTitle('Team Info').addFields(
		{ name: 'Blue Team', value: `${blueTeam.members.length}人`, inline: true },
		{ name: 'Red Team', value: `${redTeam.members.length}人`, inline: true },
		{
			name: '組み合わせ候補',
			value: combinationSummary,
			inline: true,
		},
		{
			name: 'チーム戦力差',
			value: `${powerDifference}ポイント`,
			inline: true,
		},
		{
			name: 'Blue戦力合計',
			value: `${blueTeam.totalRankPoints}ポイント`,
			inline: true,
		},
		{
			name: 'Red戦力合計',
			value: `${redTeam.totalRankPoints}ポイント`,
			inline: true,
		},
	)
	teamInfoEmbed.addFields({
		name: '除外メンバー',
		value: excludedMembers.length ? excludedMembers.map((member) => `<@${member.id}>`).join('\n') : 'なし',
		inline: false,
	})

	return [blueTeamEmbed, redTeamEmbed, teamInfoEmbed]
}

export async function executeBalance(interaction: ChatInputCommandInteraction) {
	await interaction.deferReply()

	const result = await getFilteredMembers(interaction)
	if (!result.success || !result.filteredMembers) {
		await interaction.editReply({ content: result.error })
		return
	}

	const { filteredMembers, excludedMembers } = result

	const rankDataResult = await fetchRankData(filteredMembers.map((voiceMember) => voiceMember.id))
	if (!rankDataResult.success) {
		await interaction.editReply({ content: rankDataResult.error })
		return
	}

	if (!rankDataResult.ranks) {
		await interaction.editReply({ content: ERROR_MESSAGES.RANK_DATA_FETCH_FAILED })
		return
	}

	const allTeamCombinations = generateAllTeamCombinations(filteredMembers, rankDataResult.ranks)

	const eligibleCombinations = allTeamCombinations.filter(
		(combination) => combination.powerDifference <= MAX_POWER_DIFFERENCE,
	)

	let chosenCombination: TeamCombination | undefined
	let combinationSummary: { current: number; total: number }

	if (eligibleCombinations.length > 0) {
		const selectedIndex = Math.floor(Math.random() * eligibleCombinations.length)
		chosenCombination = eligibleCombinations[selectedIndex]
		combinationSummary = {
			current: selectedIndex + 1,
			total: eligibleCombinations.length,
		}
	} else {
		const sortedByPowerDifference = [...allTeamCombinations].sort((a, b) => a.powerDifference - b.powerDifference)
		chosenCombination = sortedByPowerDifference[0]
		combinationSummary = { current: 1, total: allTeamCombinations.length }
	}

	if (!chosenCombination) {
		await interaction.editReply({ content: ERROR_MESSAGES.COMBINATION_SELECTION_ERROR })
		return
	}

	const responseEmbeds = createBalanceTeamEmbeds(chosenCombination.blueTeam, chosenCombination.redTeam, {
		combinationInfo: combinationSummary,
		excludedMembers,
	})

	await interaction.editReply({ embeds: responseEmbeds })
}
