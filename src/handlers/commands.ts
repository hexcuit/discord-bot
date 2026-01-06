import { Collection } from 'discord.js'
import * as commands from '@/commands'
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
	return (
		typeof obj.command === 'object' && obj.command !== null && typeof obj.execute === 'function'
	)
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

export const loadCommands = (): Collection<string, Command> => {
	const collection = new Collection<string, Command>()
	const commandList = Object.values(commands)

	let loadedCount = 0
	let failedCount = 0
	const duplicateCommands: string[] = []

	for (const command of commandList) {
		if (!command) {
			failedCount++
			continue
		}

		if (!isValidCommand(command)) {
			logger.error('Invalid command structure')
			failedCount++
			continue
		}

		const commandName = command.command.name
		if (collection.has(commandName)) {
			logger.error(`Duplicate command name "${commandName}"`)
			duplicateCommands.push(commandName)
			failedCount++
			continue
		}

		collection.set(commandName, command)
		loadedCount++
	}

	logger.info(`Commands loaded: ${loadedCount} succeeded, ${failedCount} failed`)

	if (duplicateCommands.length > 0) {
		logger.warn(`Duplicate command names found: ${duplicateCommands.join(', ')}`)
	}

	if (loadedCount === 0 && commandList.length > 0) {
		logger.warn('No commands loaded successfully. Check command file structure and exports.')
	}

	return collection
}
