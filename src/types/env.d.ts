declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DISCORD_TOKEN: string
			DISCORD_CLIENT_ID: string
			DISCORD_GUILD_ID: string | undefined
			DISCORD_LOG_WEBHOOK_URL: string | undefined
			API_BASE_URL: string
			API_KEY: string
		}
	}
}

export {}
