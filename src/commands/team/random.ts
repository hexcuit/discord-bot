import { type ChatInputCommandInteraction, EmbedBuilder, type GuildMember } from 'discord.js'
import { colors } from '@/config'
import { getFilteredMembers, shuffleArray } from './shared'

// 型定義
interface TeamMemberSimple {
	member: GuildMember
}

interface TeamSimple {
	members: TeamMemberSimple[]
}

const formatTeamMemberFieldSimple = (teamMember: TeamMemberSimple) => {
	return {
		name: '',
		value: `<@${teamMember.member.id}>`,
		inline: false,
	}
}

function createRandomTeams(members: GuildMember[]): { blueTeam: TeamSimple; redTeam: TeamSimple } {
	const shuffledMembers = shuffleArray(members)
	const teamSize = Math.floor(shuffledMembers.length / 2)

	const blueTeamMembers = shuffledMembers.slice(0, teamSize).map((member) => ({ member }))
	const redTeamMembers = shuffledMembers.slice(teamSize).map((member) => ({ member }))

	return {
		blueTeam: { members: blueTeamMembers },
		redTeam: { members: redTeamMembers },
	}
}

function createRandomTeamEmbeds(
	blueTeam: TeamSimple,
	redTeam: TeamSimple,
	options?: {
		excludedMembers?: GuildMember[]
	},
): EmbedBuilder[] {
	const blueTeamEmbed = new EmbedBuilder()
		.setTitle('Blue Team')
		.addFields(blueTeam.members.map((member) => formatTeamMemberFieldSimple(member)))
		.setColor(colors.blue)

	const redTeamEmbed = new EmbedBuilder()
		.setTitle('Red Team')
		.addFields(redTeam.members.map((member) => formatTeamMemberFieldSimple(member)))
		.setColor(colors.red)

	const excludedMembers = options?.excludedMembers ?? []
	const teamInfoEmbed = new EmbedBuilder().setTitle('Team Info').addFields(
		{ name: 'Blue Team', value: `${blueTeam.members.length}人`, inline: true },
		{ name: 'Red Team', value: `${redTeam.members.length}人`, inline: true },
		{
			name: '除外メンバー',
			value: excludedMembers.length ? excludedMembers.map((member) => `<@${member.id}>`).join('\n') : 'なし',
			inline: false,
		},
	)

	return [blueTeamEmbed, redTeamEmbed, teamInfoEmbed]
}

export async function executeRandom(interaction: ChatInputCommandInteraction) {
	await interaction.deferReply()

	const result = await getFilteredMembers(interaction)
	if (!result.success || !result.filteredMembers) {
		await interaction.editReply({ content: result.error })
		return
	}

	const { filteredMembers, excludedMembers } = result

	const { blueTeam, redTeam } = createRandomTeams(filteredMembers)

	const responseEmbeds = createRandomTeamEmbeds(blueTeam, redTeam, {
		excludedMembers,
	})

	await interaction.editReply({ embeds: responseEmbeds })
}
