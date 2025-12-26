/**
 * Replace canary dependencies with stable versions if they exist on npm.
 * Used during changeset version to ensure releases use stable dependencies.
 */

import { $ } from 'bun'

const packageJsonPath = './package.json'
const packageJson = await Bun.file(packageJsonPath).json()

const canaryPattern = /^(\d+\.\d+\.\d+)-canary.*/

async function checkNpmVersion(packageName: string, version: string): Promise<boolean> {
	try {
		const result = await $`npm view ${packageName}@${version} version`.quiet().text()
		return result.trim() === version
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
	await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, '\t'))
	console.log('\nUpdated package.json with stable versions')

	console.log('Running bun install to update lockfile...')
	await $`bun install`
	console.log('✓ Lockfile updated')
} else {
	console.log('\nNo changes needed')
}
