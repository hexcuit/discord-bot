# @hexcuit/discord-bot

## 0.10.0

### Minor Changes

- [#60](https://github.com/hexcuit/discord-bot/pull/60) [`c805f05`](https://github.com/hexcuit/discord-bot/commit/c805f052cfc2444ffa9975e19e9257144abe5595) Thanks [@11gather11](https://github.com/11gather11)! - Refactor all commands to use new server API

  - Update all API endpoints to match new server v1 routes
  - Add `/stats` command for viewing user statistics
  - Refactor queue commands (anonymous, create, rank) for new response format
  - Update ranking command with improved error handling
  - Fix admin reset user command for new API
  - Add unit tests for balance utility
  - Add test setup infrastructure with Bun test

## 0.9.0

### Minor Changes

- [#56](https://github.com/hexcuit/discord-bot/pull/56) [`8aa9e12`](https://github.com/hexcuit/discord-bot/commit/8aa9e1286d9a64adbf87281f98d17ef4d3be375c) Thanks [@11gather11](https://github.com/11gather11)! - feat: 管理者用コマンドを追加

  - `/admin reset all` - サーバー全体のランク・マッチ履歴を初期化
  - `/admin reset user` - 特定ユーザーのランク・マッチ履歴を初期化
  - 確認ダイアログ付きで誤操作を防止

- [#55](https://github.com/hexcuit/discord-bot/pull/55) [`86980ae`](https://github.com/hexcuit/discord-bot/commit/86980ae328a3b00b5eb8f9c96bde0ec4022ff56a) Thanks [@11gather11](https://github.com/11gather11)! - feat: ランク戦に引き分け機能を追加

  - キャンセルボタンを「引き分け」ボタンに置き換え
  - 2 段階確定ロジック: 過半数(6 票)で早期確定、全員投票後は最多得票で確定
  - 引き分け時はレーティング変動なし

### Patch Changes

- [#51](https://github.com/hexcuit/discord-bot/pull/51) [`db49446`](https://github.com/hexcuit/discord-bot/commit/db49446317bc1cd00a1821fc8d624215981a09d5) Thanks [@11gather11](https://github.com/11gather11)! - chore: @hexcuit/server v1 API への移行

  - 新しい v1 エンドポイント形式に対応
  - パスパラメータ形式へ変更
  - レスポンス型の更新に対応

## 0.8.3

### Patch Changes

- [#49](https://github.com/hexcuit/discord-bot/pull/49) [`5139927`](https://github.com/hexcuit/discord-bot/commit/513992787d488b95032e34a18303be2372c11f9e) Thanks [@11gather11](https://github.com/11gather11)! - ランク戦の改善:
  - 強制開始権限を主催者から管理者に変更
  - 投票確定条件を固定 6 票からサーバー側の過半数判定に変更
  - @hexcuit/server を 0.8.2 にアップデート

## 0.8.2

### Patch Changes

- [#47](https://github.com/hexcuit/discord-bot/pull/47) [`94fd8e1`](https://github.com/hexcuit/discord-bot/commit/94fd8e1894196b3b890a278df6951a9b1de82610) Thanks [@11gather11](https://github.com/11gather11)! - ランク戦参加フローを改善: ロール選択前に参加処理を実行するよう変更

  - 参加ボタン押下時に即座に参加処理を行うよう変更
  - ロール選択後の「参加確定」ボタンを「完了」ボタンに変更
  - これにより参加後の`update-role`コマンドが正しく機能するようになる

## 0.8.1

### Patch Changes

- [#45](https://github.com/hexcuit/discord-bot/pull/45) [`3a51041`](https://github.com/hexcuit/discord-bot/commit/3a5104168ba22e480043b5828c10506e32622e7c) Thanks [@11gather11](https://github.com/11gather11)! - rank-join-message-update

## 0.8.0

### Minor Changes

- [#42](https://github.com/hexcuit/discord-bot/pull/42) [`fc5dab9`](https://github.com/hexcuit/discord-bot/commit/fc5dab9db98d01ec4d56e00656ce19cc810d8d22) Thanks [@11gather11](https://github.com/11gather11)! - Phase 3: ランク戦チーム分け・勝敗投票・/rank server コマンド追加

  - ランク戦募集完了時の自動チーム分け（Elo バランス）
  - 勝敗投票 UI（Blue/Red 投票ボタン）
  - 6 票以上で試合確定・レート更新
  - `/rank server [@user]` - サーバー内ランク表示
  - `/rank leaderboard [limit]` - サーバーランキング表示

- [#44](https://github.com/hexcuit/discord-bot/pull/44) [`149371a`](https://github.com/hexcuit/discord-bot/commit/149371ac1a2f1fb488ca5718344914b8aa6882ad) Thanks [@11gather11](https://github.com/11gather11)! - Phase 4: 統計カード画像生成機能

  - `/rank server` コマンドで統計カード画像を生成して表示
  - Satori + Resvg による PNG 画像生成
  - 表示内容: ランク、レート、勝敗、勝率、直近 5 試合の結果

- [#40](https://github.com/hexcuit/discord-bot/pull/40) [`a65da60`](https://github.com/hexcuit/discord-bot/commit/a65da60462ca03872073bc0958458cf7e12e5cba) Thanks [@11gather11](https://github.com/11gather11)! - /recruit rank サブコマンドを追加（ロール選択付きランク戦募集）

  - recruit コマンドをファイル分割して保守性を向上
    - index.ts: コマンド定義とルーティング
    - shared.ts: 共通定数・型・Embed/ボタン作成関数
    - create.ts: /recruit create 実装
    - anonymous.ts: /recruit anonymous 実装
    - rank.ts: /recruit rank 実装
    - button.ts: ボタンハンドラー
    - selectMenu.ts: セレクトメニューハンドラー
  - @hexcuit/server v0.6.0 に更新

## 0.7.1

### Patch Changes

- [#38](https://github.com/hexcuit/discord-bot/pull/38) [`41159f2`](https://github.com/hexcuit/discord-bot/commit/41159f2e24c1ba97c553919147cae8603322afff) Thanks [@11gather11](https://github.com/11gather11)! - API パスを `/rank` から `/lol/rank` に更新

  @hexcuit/server の構造変更に対応。

## 0.7.0

### Minor Changes

- [#36](https://github.com/hexcuit/discord-bot/pull/36) [`0b67d85`](https://github.com/hexcuit/discord-bot/commit/0b67d852fea29b12d9e94994361dd92e2626b3d4) Thanks [@11gather11](https://github.com/11gather11)! - /random コマンドを削除し、/team コマンドにサブコマンドとして統合

  - `/team balance` - ランクによる実力差を考慮したチーム分け
  - `/team random` - 完全ランダムでチーム分け
  - 共通ロジックを `shared.ts` に分離してコードの重複を削減

## 0.6.0

### Minor Changes

- [#27](https://github.com/hexcuit/discord-bot/pull/27) [`c114e97`](https://github.com/hexcuit/discord-bot/commit/c114e97b266f30ec87ae37a76131003ed1298697) Thanks [@11gather11](https://github.com/11gather11)! - /recruit コマンドをサブコマンド構造に変更し、description オプションを追加

  - `/recruit create` - 通常募集を作成
  - `/recruit anonymous` - 匿名募集を作成
  - `description`オプションで募集要項を設定可能（例: ワイワイやりましょう！）
  - 参加/キャンセル時に description が維持されるよう改善

## 0.5.1

### Patch Changes

- [#25](https://github.com/hexcuit/discord-bot/pull/25) [`d4cab55`](https://github.com/hexcuit/discord-bot/commit/d4cab55b186df635da17b9a863b8746d69a7894e) Thanks [@11gather11](https://github.com/11gather11)! - 匿名募集のタイトルに「（匿名）」を表示するように改善

## 0.5.0

### Minor Changes

- [#23](https://github.com/hexcuit/discord-bot/pull/23) [`e09f2eb`](https://github.com/hexcuit/discord-bot/commit/e09f2ebca9429c65e4f40b3eafe777391bd38053) Thanks [@11gather11](https://github.com/11gather11)! - 募集終了ボタンと匿名モードの改善

  - 募集終了ボタンを追加（主催者のみ操作可能）
  - 匿名モードでコマンド実行者が非表示になるよう改善
  - @hexcuit/server を 0.3.0 に更新

## 0.4.0

### Minor Changes

- [#21](https://github.com/hexcuit/discord-bot/pull/21) [`54da145`](https://github.com/hexcuit/discord-bot/commit/54da14568453bd44272df66e216581dba37e8924) Thanks [@11gather11](https://github.com/11gather11)! - Add /recruit command for custom game recruitment

  - 10 person capacity with join/cancel buttons
  - Anonymous mode (show count only) and normal mode (show participant list)
  - Mention all participants when full
  - Guild-only command with proper error handling

## 0.3.5

### Patch Changes

- [#13](https://github.com/hexcuit/discord-bot/pull/13) [`a86dabe`](https://github.com/hexcuit/discord-bot/commit/a86dabe5c916b362e97096e3d55651b2af2234b5) Thanks [@11gather11](https://github.com/11gather11)! - random team

## 0.3.4

### Patch Changes

- [#9](https://github.com/hexcuit/discord-bot/pull/9) [`f680519`](https://github.com/hexcuit/discord-bot/commit/f680519c901b99909c629d0e4ed40996fe4c21a8) Thanks [@11gather11](https://github.com/11gather11)! - updateActivity

## 0.3.3

### Patch Changes

- [#6](https://github.com/hexcuit/discord-bot/pull/6) [`82e7549`](https://github.com/hexcuit/discord-bot/commit/82e75492eca5cd1f63c22f8673e00e13d6156574) Thanks [@11gather11](https://github.com/11gather11)! - fix scripts

## 0.3.2

### Patch Changes

- [#4](https://github.com/hexcuit/discord-bot/pull/4) [`a22fa53`](https://github.com/hexcuit/discord-bot/commit/a22fa5398094e92083b7a11f72acf721e5686646) Thanks [@11gather11](https://github.com/11gather11)! - docker fix

## 0.3.1

### Patch Changes

- [#2](https://github.com/hexcuit/discord-bot/pull/2) [`7624181`](https://github.com/hexcuit/discord-bot/commit/7624181bcf4f39c0fb27bacbf394215ad58e8557) Thanks [@11gather11](https://github.com/11gather11)! - test
