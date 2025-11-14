import { EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { colors, emoji } from '@/config'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'
import { apiClient } from '@/utils/api-client'

// 型定義
interface RankInfo {
	discordId: string
	tier: string
	division: string
}

interface TeamMember {
	member: GuildMember
	rank: number
	tier: string
	division: string
}

interface Team {
	members: TeamMember[]
	totalRankPoints: number
}

interface TeamCombination {
	blueTeam: Team
	redTeam: Team
	powerDifference: number
	combinationId: number
}

// ディビジョンボーナスポイント
const DIVISION_BONUS_POINTS = 5

// 戦力差のしきい値（この値以下の組み合わせのみを候補とする）
const MAX_POWER_DIFFERENCE = 10

const ERROR_MESSAGES = {
	SERVER_ONLY: 'このコマンドはサーバー内でのみ使用できます。',
	VOICE_CHANNEL_REQUIRED: 'このコマンドを使用するには、ボイスチャンネルに参加している必要があります。',
	API_ERROR: '登録中にエラーが発生しました。後でもう一度お試しください。',
	INSUFFICIENT_MEMBERS: 'チーム分けには最低2人必要です。',
	RANK_DATA_FETCH_FAILED: 'ランクデータの取得に失敗しました。',
	NO_COMBINATIONS: 'チーム組み合わせを生成できませんでした。',
	COMBINATION_SELECTION_ERROR: 'チーム組み合わせの選択でエラーが発生しました。',
} as const

// ユーティリティ関数
const calculateRankValue = (tier: string, division: string): number => {
	// 各ティアのベース値（実際のスキル差を反映）
	const tierValues: Record<string, number> = {
		UNRANKED: 5,
		IRON: 10,
		BRONZE: 30,
		SILVER: 50,
		GOLD: 70,
		PLATINUM: 90,
		EMERALD: 110, // プラチナとダイヤモンドの間
		DIAMOND: 130,
		MASTER: 150, // ディビジョンなし
		GRANDMASTER: 170, // ディビジョンなし
		CHALLENGER: 190, // ディビジョンなし
	}

	const baseValue = tierValues[tier] || 0

	// ディビジョンボーナスを追加（高いディビジョンほど高い値）
	if (division && ['IV', 'III', 'II', 'I'].includes(division)) {
		const divisionBonus = ['IV', 'III', 'II', 'I'].indexOf(division)
		return baseValue + divisionBonus * DIVISION_BONUS_POINTS
	}

	return baseValue
}

const getRankEmoji = (tier: string): string => {
	return emoji[tier as keyof typeof emoji] || ''
}

function validateUserAccess(member: unknown): {
	isValid: boolean
	member?: GuildMember
	error?: string
} {
	if (!(member instanceof GuildMember)) {
		return { isValid: false, error: ERROR_MESSAGES.SERVER_ONLY }
	}

	const voiceChannel = member.voice.channel
	if (!voiceChannel) {
		return { isValid: false, error: ERROR_MESSAGES.VOICE_CHANNEL_REQUIRED }
	}

	return { isValid: true, member }
}

const fetchRankData = async (
	discordIds: string[],
): Promise<{ success: boolean; ranks?: RankInfo[]; error?: string }> => {
	try {
		if (!apiClient.rank?.$get) {
			throw new Error('API client rank endpoint not available')
		}

		const response = await apiClient.rank.$get({
			query: { discordIds },
		})

		if (!response.ok) {
			logger.error('APIリクエスト失敗:', response.status, response.statusText)
			return { success: false, error: ERROR_MESSAGES.API_ERROR }
		}

		const data = (await response.json()) as { ranks: RankInfo[] }
		return { success: true, ranks: data.ranks }
	} catch (error) {
		logger.error('API呼び出しエラー:', error)
		return { success: false, error: ERROR_MESSAGES.API_ERROR }
	}
}

const parseExcludedUserIds = (input?: string | null): string[] => {
	if (!input) {
		return []
	}

	const ids = new Set<string>()

	for (const [, userId] of input.matchAll(/<@!?(\d+)>/g)) {
		if (userId) {
			ids.add(userId)
		}
	}

	input
		.split(/[\s,]+/)
		.map((token) => token.trim())
		.filter(Boolean)
		.forEach((token) => {
			if (/^\d+$/.test(token)) {
				ids.add(token)
			}
		})

	return Array.from(ids)
}

const formatTeamMemberField = (teamMember: TeamMember) => {
	const divisionText = teamMember.division ? ` ${teamMember.division}` : ''
	const rankText = `${teamMember.rank}ポイント`

	return {
		name: '',
		value: `${getRankEmoji(teamMember.tier)}${divisionText} <@${teamMember.member.id}> ・ ${rankText}`,
		inline: false,
	}
}

function generateAllTeamCombinations(members: GuildMember[], rankData: RankInfo[]): TeamCombination[] {
	// メンバーにランク情報を付与
	const membersWithRank: TeamMember[] = members.map((member) => {
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

	// 指定サイズのメンバー組み合わせを生成（ブルーチーム用）
	function generateMemberCombinations(availableMembers: TeamMember[], requiredSize: number): TeamMember[][] {
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
		// レッドチームは残りのメンバーで構成
		const redTeamMembers = membersWithRank.filter(
			(member) => !blueTeamMembers.some((blueMember) => blueMember.member.id === member.member.id),
		)

		const blueTeam: Team = {
			members: blueTeamMembers,
			totalRankPoints: blueTeamMembers.reduce((sum, member) => sum + member.rank, 0),
		}

		const redTeam: Team = {
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

function createTeamEmbeds(
	blueTeam: Team,
	redTeam: Team,
	options?: {
		combinationInfo?: { current: number; total: number }
		excludedMembers?: GuildMember[]
	},
): EmbedBuilder[] {
	// ブルーチームのEmbed作成
	const blueTeamEmbed = new EmbedBuilder()
		.setTitle('Blue Team')
		.addFields(blueTeam.members.map((member) => formatTeamMemberField(member)))
		.setColor(colors.blue)

	// レッドチームのEmbed作成
	const redTeamEmbed = new EmbedBuilder()
		.setTitle('Red Team')
		.addFields(redTeam.members.map((member) => formatTeamMemberField(member)))
		.setColor(colors.red)

	// チーム間の戦力差を計算
	const powerDifference = Math.abs(blueTeam.totalRankPoints - redTeam.totalRankPoints)

	// チーム情報のEmbed作成
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

export default {
	command: new SlashCommandBuilder()
		.setName('team')
		.setDescription('ランクによる実力差を考慮したチーム分けを行います')
		.addStringOption((option) =>
			option
				.setName('exclude')
				.setDescription('チーム分けから除外するユーザーを @メンションまたはIDでスペース区切り指定')
				.setRequired(false),
		),

	execute: async (interaction) => {
		await interaction.deferReply()

		// ユーザーアクセスとボイスチャンネルの検証
		const validation = validateUserAccess(interaction.member)
		if (!validation.isValid) {
			await interaction.reply({
				content: validation.error,
				flags: MessageFlags.Ephemeral,
			})
			return
		}

		const { member } = validation
		if (!member?.voice?.channel) {
			await interaction.editReply({
				content: ERROR_MESSAGES.VOICE_CHANNEL_REQUIRED,
			})
			return
		}
		const voiceChannel = member.voice.channel

		// ボイスチャンネルメンバーを取得（ボット除外）
		const channelMembers = Array.from(voiceChannel.members.filter((voiceMember) => !voiceMember.user.bot).values())

		const excludeOption = interaction.options.getString('exclude')
		const excludedUserIds = new Set(parseExcludedUserIds(excludeOption))
		const excludedMembers = channelMembers.filter((voiceMember) => excludedUserIds.has(voiceMember.id))
		const filteredMembers = channelMembers.filter((voiceMember) => !excludedUserIds.has(voiceMember.id))

		if (filteredMembers.length < 2) {
			await interaction.editReply({
				content: ERROR_MESSAGES.INSUFFICIENT_MEMBERS,
			})
			return
		}

		// ランクデータを取得
		const rankDataResult = await fetchRankData(filteredMembers.map((voiceMember) => voiceMember.id))
		if (!rankDataResult.success) {
			await interaction.editReply({
				content: rankDataResult.error,
			})
			return
		}

		// 全ての可能なチーム組み合わせを生成
		if (!rankDataResult.ranks) {
			await interaction.editReply({
				content: ERROR_MESSAGES.RANK_DATA_FETCH_FAILED,
			})
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
			await interaction.editReply({
				content: ERROR_MESSAGES.COMBINATION_SELECTION_ERROR,
			})
			return
		}

		// 組み合わせ情報付きEmbed作成
		const responseEmbeds = createTeamEmbeds(chosenCombination.blueTeam, chosenCombination.redTeam, {
			combinationInfo: combinationSummary,
			excludedMembers,
		})

		await interaction.editReply({ embeds: responseEmbeds })
	},
} satisfies Command
