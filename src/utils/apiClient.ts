import { hcWithType } from '@hexcuit/server'

export const apiClient = hcWithType(Bun.env.API_BASE_URL, {
	headers: { 'x-api-key': Bun.env.API_KEY },
})
