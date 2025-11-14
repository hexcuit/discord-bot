import { Glob } from 'bun'
import { type Client, Events } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Event } from '@/types/event'

/**
 * オブジェクトがEvent interfaceに準拠しているかを検証します。
 * 必須フィールドとDiscord.jsイベント名の有効性をチェックします。
 *
 * @param event - Eventとして検証するオブジェクト
 * @returns 有効なEventの場合true、そうでなければfalse
 */
const isValidEvent = (event: unknown): event is Event => {
	if (!event || typeof event !== 'object') return false

	const evt = event as Record<string, unknown>

	// 必須フィールド
	if (!evt.name || typeof evt.name !== 'string') return false
	if (typeof evt.once !== 'boolean') return false
	if (!evt.execute || typeof evt.execute !== 'function') return false

	// イベント名が有効なDiscord.jsイベントかを検証
	const validEvents = Object.values(Events) as string[]
	if (!validEvents.includes(evt.name)) {
		logger.warn(`未知のDiscord.jsイベント: ${evt.name}`)
		return false
	}

	return true
}

/**
 * eventsディレクトリからDiscord.jsイベントを並列で読み込みます。
 * イベントを検証してDiscord.jsクライアントに登録します。
 *
 * @param client - イベントを登録するDiscord.js Clientインスタンス
 * @returns 全イベントの処理が完了したときに解決するPromise
 */
export const loadEvents = async (client: Client): Promise<void> => {
	const glob = new Glob('*/index.{js,ts}')
	const dir = `${import.meta.dir}/../events`

	// 並列読み込みのためにまず全ファイルパスを収集
	const eventFiles = await Array.fromAsync(glob.scan(dir))

	// イベントを並列で読み込み
	const loadEventPromises = eventFiles.map(async (file) => {
		try {
			const eventModule = await import(`${dir}/${file}`)
			const event = eventModule.default

			if (!event) {
				logger.error(`イベントファイル ${file} がデフォルトイベントをエクスポートしていません`)
				return { file, event: null, success: false }
			}

			return { file, event, success: true }
		} catch (error) {
			if (error instanceof SyntaxError) {
				logger.error(`イベントファイル ${file} で構文エラー: ${error.message}`)
			} else if (error instanceof TypeError) {
				logger.error(`イベント ${file} 読み込み時に型エラー: ${error.message}`)
			} else {
				logger.error(`イベント ${file} の読み込みに失敗:`, error)
			}
			return { file, event: null, success: false, error }
		}
	})

	const results = await Promise.allSettled(loadEventPromises)

	// 全インポート完了後にイベントを登録
	const processedResults = results.map((result) => {
		if (result.status === 'fulfilled' && result.value.success) {
			const { file, event } = result.value

			if (!isValidEvent(event)) {
				logger.error(`無効なイベント構造 ${file}:`, {
					hasName: !!event?.name,
					hasOnce: typeof event?.once === 'boolean',
					hasExecute: typeof event?.execute === 'function',
				})
				return { success: false, file, event: null }
			}

			if (event.once) {
				client.once(event.name, (...parameters) => {
					try {
						return event.execute(...parameters)
					} catch (error) {
						logger.error(`イベント ${event.name} でエラー:`, error)
					}
				})
			} else {
				client.on(event.name, (...parameters) => {
					try {
						return event.execute(...parameters)
					} catch (error) {
						logger.error(`イベント ${event.name} でエラー:`, error)
					}
				})
			}

			logger.debug(`イベントを読み込み: ${event.name}`)
			return { success: true, file, event }
		} else {
			return { success: false, file: 'unknown', event: null }
		}
	})

	// カウントを計算
	const loadedCount = processedResults.filter((result) => result.success).length
	const failedCount = processedResults.length - loadedCount

	logger.info(`イベント読み込み完了: ${loadedCount}個読み込み、${failedCount}個失敗`)
}
