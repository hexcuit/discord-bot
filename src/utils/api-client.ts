import { hcWithType } from '@hexcuit/server'

export const apiClient = hcWithType(import.meta.env.API_BASE_URL, {
	headers: { 'x-api-key': import.meta.env.API_KEY },
})
