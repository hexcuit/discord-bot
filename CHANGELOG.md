# @hexcuit/discord-bot

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
