#!/usr/bin/env bun
/**
 * Changeset version script for CI
 *
 * Runs changeset version and fixes canary dependencies.
 * Used by changesets/action since it doesn't support && in version command.
 */

import { execSync } from 'node:child_process'

execSync('bun changeset version', { stdio: 'inherit' })
execSync('bun scripts/fix-canary-deps.ts', { stdio: 'inherit' })
