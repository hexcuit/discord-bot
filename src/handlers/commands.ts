import { Glob } from 'bun'
import { Collection } from 'discord.js'
import { logger } from '@/lib/logger'
import type { Command } from '@/types/command'

type CommandData = {
	name: string
	description: string
	[key: string]: unknown
}

type RawCommand = {
	command: CommandData
	execute: (...args: unknown[]) => unknown
	autocomplete?: (...args: unknown[]) => unknown
	modal?: (...args: unknown[]) => unknown
	button?: (...args: unknown[]) => unknown
	[key: string]: unknown
}

const hasRequiredFields = (cmd: unknown): cmd is RawCommand => {
	if (!cmd || typeof cmd !== 'object') return false
	const obj = cmd as Record<string, unknown>
	return typeof obj.command === 'object' && obj.command !== null && typeof obj.execute === 'function'
}

const hasValidCommandData = (data: unknown): data is CommandData => {
	if (!data || typeof data !== 'object') return false
	const obj = data as Record<string, unknown>
	return typeof obj.name === 'string' && typeof obj.description === 'string'
}

const validateCommandName = (name: string): boolean => {
	const nameRegex = /^[\w-]{1,32}$/
	if (!nameRegex.test(name)) {
		logger.warn(`Command name "${name}" must be 1-32 characters and use only alphanumeric, -, _`)
		return false
	}
	return true
}

const validateDescription = (description: string, commandName: string): boolean => {
	if (description.length > 100) {
		logger.warn(`Command "${commandName}" description exceeds 100 character limit`)
		return false
	}
	return true
}

const validateOptionalHandlers = (cmd: RawCommand): boolean => {
	if (cmd.autocomplete && typeof cmd.autocomplete !== 'function') return false
	if (cmd.modal && typeof cmd.modal !== 'function') return false
	if (cmd.button && typeof cmd.button !== 'function') return false
	return true
}

const isValidCommand = (cmd: unknown): cmd is Command => {
	if (!hasRequiredFields(cmd)) return false
	if (!hasValidCommandData(cmd.command)) return false
	if (!validateCommandName(cmd.command.name)) return false
	if (!validateDescription(cmd.command.description, cmd.command.name)) return false
	if (!validateOptionalHandlers(cmd)) return false
	return true
}

type LoadResult = {
	file: string
	command: Command | null
	commandName?: string
	isDuplicate: boolean
	error?: unknown
}

export const loadCommands = async (): Promise<Collection<string, Command>> => {
	const collection = new Collection<string, Command>()
	const glob = new Glob('*/index.{js,ts}')
	const dir = `${import.meta.dir}/../commands`

	const commandFiles = await Array.fromAsync(glob.scan(dir))

	const loadResults = await Promise.all(
		commandFiles.map(async (file): Promise<LoadResult> => {
			try {
				const commandModule = await import(`${dir}/${file}`)
				const command = commandModule.default

				if (!command) {
					logger.error(`Command file ${file} does not export a default command`)
					return { file, command: null, isDuplicate: false }
				}

				if (!isValidCommand(command)) {
					logger.error(`Invalid command structure: ${file}`)
					return { file, command: null, isDuplicate: false }
				}

				const commandName = command.command.name
				const isDuplicate = collection.has(commandName)

				if (isDuplicate) {
					logger.error(`Duplicate command name "${commandName}" found in ${file}`)
					return { file, command, commandName, isDuplicate: true }
				}

				return { file, command, commandName, isDuplicate: false }
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				logger.error(`Failed to load command ${file}:`, errorMessage)
				return { file, command: null, isDuplicate: false, error }
			}
		}),
	)

	let loadedCount = 0
	let failedCount = 0
	const duplicateCommands: string[] = []

	loadResults.forEach((result) => {
		if (result.command && result.commandName && !result.isDuplicate) {
			collection.set(result.commandName, result.command)
			loadedCount++
		} else {
			failedCount++
			if (result.isDuplicate && result.commandName) {
				duplicateCommands.push(result.commandName)
			}
		}
	})

	logger.info(`Commands loaded: ${loadedCount} succeeded, ${failedCount} failed`)

	if (duplicateCommands.length > 0) {
		logger.warn(`Duplicate command names found: ${duplicateCommands.join(', ')}`)
	}

	if (loadedCount === 0 && commandFiles.length > 0) {
		logger.warn('No commands loaded successfully. Check command file structure and exports.')
	}

	return collection
}
