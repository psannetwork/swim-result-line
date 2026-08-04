# Swim Result Line Bot

水泳大会のライブスコアを取得し、登録した選手が出場する大会を自動的に通知するLINE Botです。

## 機能
- 選手登録: 指定した選手IDを登録して監視を開始します。
- 選手削除: 登録した選手の監視を終了します。
- 自動通知: 1時間おきに大会スケジュールをチェックし、登録選手が出場する大会があればLINEで通知します。

## コマンド
LINEで以下のコマンドを送信して操作します。

- `/add {選手ID}`: 選手を登録します。
- `/delete {選手ID}`: 登録した選手を削除します。
- `/game`: 直近の大会一覧を表示します。
- `/help`: コマンド一覧を表示します。

## セットアップ
1. `.env.example` を参考に `.env` ファイルを作成し、設定してください。
   - `CHANNEL_ACCESS_TOKEN`: LINE Messaging APIのチャネルアクセストークン
   - `CHANNEL_SECRET`: LINE Messaging APIのチャネルシークレット
   - `RATE_LIMIT_PER_MINUTE`: 1分あたりの最大リクエスト数（デフォルト: 5）
   - `RATE_LIMIT_PER_DAY`: 1日あたりの最大リクエスト数（デフォルト: 30）
2. 依存パッケージをインストールします。
   ```bash
   npm install
   ```
3. サーバーを起動します。
   ```bash
   node src/server.js
   ```
