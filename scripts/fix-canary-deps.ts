#!/usr/bin/env bun
/**
 * Fix canary dependencies
 *
 * Replace canary dependencies with stable versions if they exist on npm.
 * Used during changeset version to ensure releases use stable dependencies.
 *
 * Usage:
 *   bun scripts/fix-canary-deps.ts
 */

import { exec } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const packageJsonPath = join(import.meta.dirname, '../package.json')
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

const canaryPattern = /^(\d+\.\d+\.\d+)-canary.*/

async function checkNpmVersion(packageName: string, version: string): Promise<boolean> {
	try {
		const { stdout } = await execAsync(`npm view ${packageName}@${version} version`)
		return stdout.trim() === version
	} catch {
		return false
	}
}

let modified = false

for (const depType of ['dependencies', 'devDependencies'] as const) {
	const deps = packageJson[depType]
	if (!deps) continue

	for (const [name, version] of Object.entries(deps)) {
		if (typeof version !== 'string') continue
		if (!name.startsWith('@hexcuit/')) continue

		const match = version.match(canaryPattern)
		if (!match?.[1]) continue

		const stableVersion = match[1]
		console.log(`Found canary: ${name}@${version}`)
		console.log(`Checking if ${name}@${stableVersion} exists...`)

		const exists = await checkNpmVersion(name, stableVersion)
		if (exists) {
			console.log(`✓ Replacing with stable version: ${stableVersion}`)
			deps[name] = stableVersion
			modified = true
		} else {
			console.log(`✗ Stable version not found, keeping canary`)
		}
	}
}

if (modified) {
	await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`)
	console.log('\nUpdated package.json with stable versions')

	console.log('Running bun install to update lockfile...')
	await execAsync('bun install')
	console.log('✓ Lockfile updated')
} else {
	console.log('\nNo changes needed')
}
