---
"@hexcuit/discord-bot": minor
---

/recruitコマンドをサブコマンド構造に変更し、descriptionオプションを追加

- `/recruit create` - 通常募集を作成
- `/recruit anonymous` - 匿名募集を作成
- `description`オプションで募集要項を設定可能（例: ワイワイやりましょう！）
- 参加/キャンセル時にdescriptionが維持されるよう改善
