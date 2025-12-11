---
"@hexcuit/discord-bot": minor
---

/recruit rank サブコマンドを追加（ロール選択付きランク戦募集）

- recruitコマンドをファイル分割して保守性を向上
  - index.ts: コマンド定義とルーティング
  - shared.ts: 共通定数・型・Embed/ボタン作成関数
  - create.ts: /recruit create 実装
  - anonymous.ts: /recruit anonymous 実装
  - rank.ts: /recruit rank 実装
  - button.ts: ボタンハンドラー
  - selectMenu.ts: セレクトメニューハンドラー
- @hexcuit/server v0.6.0 に更新
