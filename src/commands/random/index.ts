import { EmbedBuilder, GuildMember, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { colors } from '@/config'
import type { Command } from '@/types/command'

interface TeamMember {
	member: GuildMember
}

interface Team {
	members: TeamMember[]
}

const ERROR_MESSAGES = {
	SERVER_ONLY: 'このコマンドはサーバー内でのみ使用できます。',
	VOICE_CHANNEL_REQUIRED: 'このコマンドを使用するには、ボイスチャンネルに参加している必要があります。',
	INSUFFICIENT_MEMBERS: 'チーム分けには最低2人必要です。',
} as const

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
	return {
		name: '',
		value: `<@${teamMember.member.id}>`,
		inline: false,
	}
}

function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = shuffled[i]
		const swapValue = shuffled[j]
		if (temp !== undefined && swapValue !== undefined) {
			shuffled[i] = swapValue
			shuffled[j] = temp
		}
	}
	return shuffled
}

function createRandomTeams(members: GuildMember[]): { blueTeam: Team; redTeam: Team } {
	const shuffledMembers = shuffleArray(members)
	const teamSize = Math.floor(shuffledMembers.length / 2)

	const blueTeamMembers = shuffledMembers.slice(0, teamSize).map((member) => ({ member }))
	const redTeamMembers = shuffledMembers.slice(teamSize).map((member) => ({ member }))

	return {
		blueTeam: { members: blueTeamMembers },
		redTeam: { members: redTeamMembers },
	}
}

function createTeamEmbeds(
	blueTeam: Team,
	redTeam: Team,
	options?: {
		excludedMembers?: GuildMember[]
	},
): EmbedBuilder[] {
	const blueTeamEmbed = new EmbedBuilder()
		.setTitle('Blue Team')
		.addFields(blueTeam.members.map((member) => formatTeamMemberField(member)))
		.setColor(colors.blue)

	const redTeamEmbed = new EmbedBuilder()
		.setTitle('Red Team')
		.addFields(redTeam.members.map((member) => formatTeamMemberField(member)))
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

export default {
	command: new SlashCommandBuilder()
		.setName('random')
		.setDescription('完全ランダムでチーム分けを行います')
		.addStringOption((option) =>
			option
				.setName('exclude')
				.setDescription('チーム分けから除外するユーザーを @メンションまたはIDでスペース区切り指定')
				.setRequired(false),
		),

	execute: async (interaction) => {
		await interaction.deferReply()

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

		const { blueTeam, redTeam } = createRandomTeams(filteredMembers)

		const responseEmbeds = createTeamEmbeds(blueTeam, redTeam, {
			excludedMembers,
		})

		await interaction.editReply({ embeds: responseEmbeds })
	},
} satisfies Command
