---
"@hexcuit/discord-bot": minor
---

/random コマンドを削除し、/team コマンドにサブコマンドとして統合

- `/team balance` - ランクによる実力差を考慮したチーム分け
- `/team random` - 完全ランダムでチーム分け
- 共通ロジックを `shared.ts` に分離してコードの重複を削減
