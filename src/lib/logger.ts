import { WebhookClient } from 'discord.js'

type LogLevel = 'error' | 'warn' | 'info' | 'log'

type Color = 'red' | 'yellow' | 'green' | 'white'

const LEVEL_COLORS: Record<LogLevel, Color> = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	log: 'white',
}

const ANSI_COLORS: Record<Color | 'reset', string> = {
	red: '\u001b[31m',
	yellow: '\u001b[33m',
	green: '\u001b[32m',
	white: '\u001b[37m',
	reset: '\u001b[0m',
}

const WEBHOOK_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info'] as const

const colorize = (color: Color, text: string): string => {
	return `${ANSI_COLORS[color]}${text}${ANSI_COLORS.reset}`
}

const getTimestamp = (): string => {
	return new Date().toLocaleString('ja-JP', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	})
}

const formatArgs = (args: unknown[]): string => {
	return args
		.map((arg) => {
			if (typeof arg === 'string') return arg
			if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`
			try {
				return JSON.stringify(arg, null, 2)
			} catch {
				return String(arg)
			}
		})
		.join(' ')
}

let webhookClient: WebhookClient | null = null

const initWebhook = (): void => {
	if (import.meta.env.NODE_ENV === 'development') {
		console.warn('[Webhook] Disabled in development environment')
		return
	}

	const webhookUrl = import.meta.env.DISCORD_LOG_WEBHOOK_URL
	if (!webhookUrl) {
		console.warn('[Webhook] DISCORD_LOG_WEBHOOK_URL is not set')
		return
	}

	try {
		webhookClient = new WebhookClient({ url: webhookUrl })
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error('[Webhook] Failed to initialize:', errorMessage)
	}
}

const sendToWebhook = async (level: LogLevel, message: string): Promise<void> => {
	if (!webhookClient) return

	try {
		const timestamp = getTimestamp()
		const color = LEVEL_COLORS[level]
		const styledLevel = colorize(color, level.toUpperCase())

		await webhookClient.send({
			username: 'Bot Logger',
			content: `\`\`\`ansi\n[${timestamp}] [${styledLevel}]: ${message}\n\`\`\``,
		})
	} catch (error) {
		// Use console.error to avoid circular reference
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error('[Webhook] Failed to send:', errorMessage)
	}
}

const logToConsole = (level: LogLevel, message: string): void => {
	const timestamp = getTimestamp()
	const color = LEVEL_COLORS[level]
	const styledLevel = colorize(color, level.toUpperCase())
	console.log(`[${timestamp}] [${styledLevel}]: ${message}`)
}

export const logger: Record<LogLevel, (...args: unknown[]) => void> = {
	error: (...args) => {
		const message = formatArgs(args)
		logToConsole('error', message)
		if (WEBHOOK_LEVELS.includes('error')) {
			sendToWebhook('error', message)
		}
	},
	warn: (...args) => {
		const message = formatArgs(args)
		logToConsole('warn', message)
		if (WEBHOOK_LEVELS.includes('warn')) {
			sendToWebhook('warn', message)
		}
	},
	info: (...args) => {
		const message = formatArgs(args)
		logToConsole('info', message)
		if (WEBHOOK_LEVELS.includes('info')) {
			sendToWebhook('info', message)
		}
	},
	log: (...args) => {
		const message = formatArgs(args)
		logToConsole('log', message)
	},
}

// Initialize webhook after logger definition
initWebhook()
