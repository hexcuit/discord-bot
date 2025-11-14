import { WebhookClient } from 'discord.js'
import winston from 'winston'

/**
 * WebhookClient のインスタンスを作成（URL が存在し有効な場合のみ）
 */
const createWebhookLogger = (): WebhookClient | null => {
	if (!Bun.env.DISCORD_LOG_WEBHOOK_URL) {
		console.error('DISCORD_LOG_WEBHOOK_URL が設定されていません')
		return null
	}
	try {
		return new WebhookClient({ url: Bun.env.DISCORD_LOG_WEBHOOK_URL })
	} catch (error) {
		console.error('WebhookClient の作成に失敗しました:', (error as Error).message)
		return null
	}
}

let webhookLogger: WebhookClient | null = null

/**
 * WebhookLoggerを初期化する関数
 */
const initializeWebhookLogger = (): void => {
	if (import.meta.env.NODE_ENV === 'development') {
		logger.warn('開発環境のため、Webhook ロガーは無効化されています')
		return
	}
	webhookLogger = createWebhookLogger()
}

/**
 * サポートされるカラー名
 */
type Colors = 'red' | 'yellow' | 'green' | 'blue' | 'magenta' | 'white'

/**
 * サポートされるログレベル
 */
type LogLevel = 'error' | 'warn' | 'success' | 'info' | 'http' | 'debug'

/**
 * ログレベルと優先度のマッピング
 */
const LOG_LEVELS = {
	error: 0,
	warn: 1,
	success: 2,
	info: 3,
	http: 4,
	debug: 5,
} as const satisfies Record<LogLevel, number>

/**
 * ログレベルと色のマッピング
 */
const LEVEL_COLORS: Record<LogLevel, Colors> = {
	error: 'red',
	warn: 'yellow',
	success: 'green',
	info: 'blue',
	http: 'magenta',
	debug: 'white',
} as const

/**
 * ANSI カラーコードの定義
 */
const ANSI_COLORS: Record<Colors | 'reset', string> = {
	red: '\u001b[31m',
	yellow: '\u001b[33m',
	green: '\u001b[32m',
	blue: '\u001b[34m',
	magenta: '\u001b[35m',
	white: '\u001b[37m',
	reset: '\u001b[0m',
}

/**
 * テキストに ANSI カラーを適用する関数
 */
const applyColor = (color: Colors, text: string): string => {
	const colorCode = ANSI_COLORS[color]
	const resetCode = ANSI_COLORS.reset
	return `${colorCode}${text}${resetCode}`
}

/**
 * 日付を日本時間でフォーマットする関数
 */
const getFormattedDate = (): string => {
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

/**
 * メッセージを文字列に変換する関数（複数引数対応）
 */
const formatMessage = (args: unknown[]): string => {
	return args
		.map((arg) => {
			if (typeof arg === 'string') {
				return arg
			}
			if (arg instanceof Error) {
				return `${arg.name} ${arg.message} ${arg.stack}`
			}
			try {
				// オブジェクトや配列を JSON 文字列に変換
				return JSON.stringify(arg, null, 2)
			} catch {
				// それ以外の型は文字列に変換
				return String(arg)
			}
		})
		.join(' ')
}

/**
 * Discord の Webhook にメッセージを送信する関数
 */
const sendWebhook = async (args: unknown[], level: LogLevel): Promise<void> => {
	if (!webhookLogger) {
		return
	}

	try {
		const date = getFormattedDate()
		const color = LEVEL_COLORS[level]
		const formattedMessage = formatMessage(args)
		const styledLevel = applyColor(color, level.toUpperCase())
		const content = `\`\`\`ansi
[${date}] [${styledLevel}]: ${formattedMessage}\`\`\``

		// エラーレベルの場合は @everyone を付加
		const webhookMessage = {
			username: 'Bot Log',
			content: level === 'error' ? `@everyone ${content}` : content,
		}

		await webhookLogger.send(webhookMessage)
	} catch (error) {
		// 循環参照を避けるためconsole.errorを使用
		console.error('Webhook 送信に失敗しました:', (error as Error).message)
	}
}

/**
 * winston のカスタムログレベルを定義
 */
const customLevels = {
	levels: LOG_LEVELS,
	colors: LEVEL_COLORS,
}

/**
 * winston にカスタムカラーを追加
 */
winston.addColors(customLevels.colors)

/**
 * ログレベルに色を適用するためのフォーマッター
 */
const colorizer = winston.format.colorize()

/**
 * winston ロガーの作成
 */
const winstonLogger = winston.createLogger({
	levels: customLevels.levels, // カスタムログレベルを適用
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp({ format: getFormattedDate() }), // タイムスタンプを追加
		winston.format.printf(({ level, message, timestamp }) => {
			return `[${timestamp}] [${level.toUpperCase()}]: ${message}`
		}),
	),
	transports: [
		// コンソールへのログ出力
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.timestamp({ format: getFormattedDate() }), // タイムスタンプを追加
				winston.format.printf(({ level, message, timestamp }) => {
					// ログレベルをカラー化
					const coloredLevel = colorizer.colorize(level, level.toUpperCase())
					return `[${timestamp}] [${coloredLevel}]: ${message}`
				}),
			),
		}),
	],
})

/**
 * ロガーのエクスポート
 */
export const logger = {} as Record<LogLevel, (...args: unknown[]) => void>

/**
 * Webhook送信対象のログレベル
 */
const WEBHOOK_LEVELS: readonly LogLevel[] = ['error', 'warn', 'success', 'info'] as const

/**
 * 各ログレベルに対応するメソッドを logger オブジェクトに追加
 */
for (const level of Object.keys(LOG_LEVELS) as LogLevel[]) {
	logger[level] = (...args: unknown[]) => {
		const message = formatMessage(args)
		// winston にログを記録
		winstonLogger.log(level, message)
		// 特定のログレベルの場合は Webhook にも送信
		if (WEBHOOK_LEVELS.includes(level)) {
			sendWebhook(args, level)
		}
	}
}

// loggerの定義後にWebhookLoggerを初期化
initializeWebhookLogger()
