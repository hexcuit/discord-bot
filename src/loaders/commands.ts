import { Glob } from 'bun'
import { Collection } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'

/**
 * オブジェクトがCommand interfaceに準拠しているかを検証します。
 * 必須フィールド、Discord.js API準拠、オプションハンドラーをチェックします。
 *
 * @param cmd - Commandとして検証するオブジェクト
 * @returns 有効なCommandの場合true、そうでなければfalse
 */
const isValidCommand = (cmd: unknown): cmd is Command => {
	if (!cmd || typeof cmd !== 'object') return false

	const command = cmd as Record<string, unknown>

	// 必須フィールドの検証
	if (!command.command || typeof command.command !== 'object') return false
	if (!command.execute || typeof command.execute !== 'function') return false

	// Discord.jsコマンド構造の要件を検証
	const commandData = command.command as Record<string, unknown>
	if (!commandData.name || typeof commandData.name !== 'string') return false
	if (!commandData.description || typeof commandData.description !== 'string') return false

	// コマンド名の要件を検証（Discord.jsの制限）
	const nameRegex = /^[\w-]{1,32}$/
	if (!nameRegex.test(commandData.name as string)) {
		logger.warn(`コマンド名 "${commandData.name}" は1-32文字で、英数字、-、_のみ使用可能です`)
		return false
	}

	// 説明文の長さを検証（Discord.jsの制限）
	if ((commandData.description as string).length > 100) {
		logger.warn(`コマンド "${commandData.name}" の説明が100文字制限を超えています`)
		return false
	}

	// オプションフィールドの検証
	if (command.autocomplete && typeof command.autocomplete !== 'function') return false
	if (command.modal && typeof command.modal !== 'function') return false
	if (command.button && typeof command.button !== 'function') return false

	return true
}

/**
 * commandsディレクトリからDiscord.jsスラッシュコマンドを並列で読み込みます。
 * コマンドを検証してclient.commands Collectionに登録します。
 * 実行時エラーハンドリングはinteractionCreateハンドラーで行われます。
 *
 * @param client - コマンドを登録するDiscord.js Clientインスタンス
 * @returns 全コマンドの処理が完了したときに解決するPromise
 */
export const loadCommands = async (): Promise<Collection<string, Command>> => {
	const collection = new Collection<string, Command>()
	const glob = new Glob('*/index.{js,ts}')
	const dir = `${import.meta.dir}/../commands`

	// 並列読み込みのためにまず全ファイルパスを収集
	const commandFiles = await Array.fromAsync(glob.scan(dir))

	// コマンドを並列で読み込み
	const loadCommandPromises = commandFiles.map(async (file) => {
		try {
			const commandModule = await import(`${dir}/${file}`)
			const command = commandModule.default

			if (!command) {
				logger.error(`コマンドファイル ${file} がデフォルトコマンドをエクスポートしていません`)
				return { file, command: null, success: false }
			}

			return { file, command, success: true }
		} catch (error) {
			if (error instanceof SyntaxError) {
				logger.error(`コマンドファイル ${file} で構文エラー: ${error.message}`)
			} else if (error instanceof TypeError) {
				logger.error(`コマンド ${file} 読み込み時に型エラー: ${error.message}`)
			} else {
				logger.error(`コマンド ${file} の読み込みに失敗:`, error)
			}
			return { file, command: null, success: false, error }
		}
	})

	const results = await Promise.allSettled(loadCommandPromises)

	// 全インポート完了後にコマンドを登録
	const processedResults = results.map((result) => {
		if (result.status === 'fulfilled' && result.value.success) {
			const { file, command } = result.value

			if (!isValidCommand(command)) {
				logger.error(`無効なコマンド構造 ${file}:`, {
					hasCommand: !!command?.command,
					hasExecute: typeof command?.execute === 'function',
					commandName: command?.command?.name || 'unknown',
					hasValidName: typeof command?.command?.name === 'string',
					hasValidDescription: typeof command?.command?.description === 'string',
				})
				return { success: false, file, command: null, isDuplicate: false }
			}

			const commandName = command.command.name
			const isDuplicate = collection.has(commandName)

			if (isDuplicate) {
				logger.error(`重複コマンド名 "${commandName}" が ${file} で見つかりました`)
				return { success: false, file, command, isDuplicate: true, commandName }
			}

			// 非破壊的な登録チェック
			return { success: true, file, command, commandName, isDuplicate: false }
		} else {
			return {
				success: false,
				file: 'unknown',
				command: null,
				isDuplicate: false,
			}
		}
	})

	// 成功したコマンドのみを登録（副作用を分離）
	processedResults
		.filter((result) => result.success)
		.forEach((result) => {
			if (result.command && result.commandName) {
				collection.set(result.commandName, result.command)
				logger.debug(`コマンドを読み込み: ${result.commandName}`)
			}
		})

	// カウントを計算
	const loadedCount = processedResults.filter((result) => result.success).length
	const failedCount = processedResults.length - loadedCount
	const duplicateCommands = processedResults
		.filter((result) => result.isDuplicate)
		.map((result) => result.commandName)
		.filter((name): name is string => name !== undefined)

	// 詳細情報とともにサマリーをログ出力
	logger.info(`コマンド読み込み完了: ${loadedCount}個読み込み、${failedCount}個失敗`)

	if (duplicateCommands.length > 0) {
		logger.warn(`重複コマンド名が見つかりました: ${duplicateCommands.join(', ')}`)
	}

	if (loadedCount === 0 && commandFiles.length > 0) {
		logger.warn('コマンドが正常に読み込まれませんでした。コマンドファイルの構造とエクスポートを確認してください。')
	}
	return collection
}
