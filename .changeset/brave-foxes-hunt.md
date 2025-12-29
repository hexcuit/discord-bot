---
"@hexcuit/discord-bot": minor
---

Refactor all commands to use new server API

- Update all API endpoints to match new server v1 routes
- Add `/stats` command for viewing user statistics
- Refactor queue commands (anonymous, create, rank) for new response format
- Update ranking command with improved error handling
- Fix admin reset user command for new API
- Add unit tests for balance utility
- Add test setup infrastructure with Bun test
