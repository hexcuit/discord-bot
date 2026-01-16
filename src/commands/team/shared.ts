import { type ChatInputCommandInteraction, GuildMember } from 'discord.js'

const ERROR_MESSAGES = {
	SERVER_ONLY: 'このコマンドはサーバー内でのみ使用できます。',
	VOICE_CHANNEL_REQUIRED:
		'このコマンドを使用するには、ボイスチャンネルに参加している必要があります。',
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

function parseExcludedUserIds(input?: string | null): string[] {
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

export async function getFilteredMembers(interaction: ChatInputCommandInteraction): Promise<{
	success: boolean
	filteredMembers?: GuildMember[]
	excludedMembers?: GuildMember[]
	error?: string
}> {
	const validation = validateUserAccess(interaction.member)
	if (!validation.isValid) {
		return { success: false, error: validation.error }
	}

	const { member } = validation
	if (!member?.voice?.channel) {
		return { success: false, error: ERROR_MESSAGES.VOICE_CHANNEL_REQUIRED }
	}
	const voiceChannel = member.voice.channel

	const channelMembers = Array.from(
		voiceChannel.members.filter((voiceMember) => !voiceMember.user.bot).values(),
	)

	const excludeOption = interaction.options.getString('exclude')
	const excludedUserIds = new Set(parseExcludedUserIds(excludeOption))
	const excludedMembers = channelMembers.filter((voiceMember) =>
		excludedUserIds.has(voiceMember.id),
	)
	const filteredMembers = channelMembers.filter(
		(voiceMember) => !excludedUserIds.has(voiceMember.id),
	)

	if (filteredMembers.length < 2) {
		return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_MEMBERS }
	}

	return { success: true, filteredMembers, excludedMembers }
}

export function shuffleArray<T>(array: T[]): T[] {
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
