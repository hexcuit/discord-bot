import { hcWithType } from '@hexcuit/server'

export const apiClient = hcWithType(process.env.API_BASE_URL, {
	headers: { 'x-api-key': process.env.API_KEY },
})
