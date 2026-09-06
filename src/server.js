require('dotenv').config();
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const handleEvent = require('./lib/line/main');
const db = require('./lib/db');
const { getGames, getAthleteRaces } = require('./lib/scraper/main');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
};

console.log('LINE configuration loaded:', {
  channelSecret: Boolean(config.channelSecret),
  channelAccessToken: Boolean(config.channelAccessToken),
});

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

const path = require('path');
const authService = require('./lib/auth/service');

const app = express();
const port = process.env.PORT || 3000;

// 静的ファイル配信（認証ページ用）
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSONボディパーサーは認証コールバックのみに適用
// ※ Webhookエンドポイント '/' では express.json() を使わないこと！
// LINE SDKのmiddlewareがraw bodyから署名検証を行うため、
// 先にJSONパースされると署名検証が失敗する

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Webhookエンドポイント: 署名検証エラーも含めて常に200を返す
// LINEプラットフォームは200以外を受け取るとリトライを繰り返すため
app.post('/', middleware(config), async (req, res) => {
  console.log('[LINE] Webhook received');

  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('[LINE] Webhook error:', err);
    // ハンドラ内のエラーでも200を返す（LINEへのリトライ防止）
    res.status(200).end();
  }
});

app.get('/', (req, res) => {
  res.send('LINE Bot is running!');
});

// 認証ページ表示
app.get('/auth', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('Invalid request: token is required');
  }
  // トークンの有効性チェック（表示のみ、消費はしない）
  const userId = authService.validateToken(token);
  if (!userId) {
    return res.status(403).send('このリンクは無効または期限切れです。LINEボットから再度/authを実行してください。');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'auth.html'));
});

// 認証コールバック（APIキー受信・保存）
// ここだけ express.json() を適用（Webhookとは別ルートなので問題なし）
app.post('/auth/callback', express.json(), async (req, res) => {
  console.log('[Auth Callback] Content-Type:', req.headers['content-type']);
  console.log('[Auth Callback] Body:', JSON.stringify(req.body));
  try {
    const { token, apiKey } = req.body || {};
    if (!token || !apiKey) {
      console.error('[Auth Callback] Missing token or apiKey. body:', req.body);
      return res.status(400).json({ error: 'tokenとapiKeyが必要です', debug: { body: req.body, contentType: req.headers['content-type'] } });
    }

    const userId = authService.validateToken(token);
    if (!userId) {
      return res.status(403).json({ error: 'トークンが無効または期限切れです' });
    }

    // APIキーの簡易バリデーション（Gemini APIキーは通常 AIzaSy で始まるが、
    // 将来的な形式変更やプロジェクト固有のプレフィックスにも対応するため緩めにチェック）
    if (typeof apiKey !== 'string' || apiKey.length < 20 || apiKey.length > 100) {
      return res.status(400).json({ error: '無効なAPIキー形式です。Google AI Studioのキーを入力してください。' });
    }

    authService.saveApiKey(userId, apiKey);
    authService.consumeToken(token);

    console.log(`[Auth] API key saved for user: ${userId}`);

    // LINEで認証完了通知を送信
    try {
      await client.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: '✅ Gemini APIキーの設定が完了しました！\n/ai コマンドでAIに質問できます。' }]
      });
    } catch (pushErr) {
      console.error('[Auth] Failed to send push message:', pushErr);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Callback error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

const { syncData, checkResults, startMonitoringLoop, calculateNextInterval } = require('./lib/monitor');

// 動的スケジューリングの開始
// 高頻度タスク：結果チェック
const getCheckResultsInterval = async () => {
    const games = await getGames();
    const activeGame = games.find(g => g.status_label === '開催中');
    if (!activeGame) return 6 * 60 * 60 * 1000; // 6時間

    // 今日が大会期間中なら今日の日付を使用
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${yyyy}-${mm}-${dd}`;
    
    console.log(`[DEBUG] Checking interval for active game: ${activeGame.game_code} on ${todayDateStr}`);
    return await calculateNextInterval(activeGame.game_code, todayDateStr);
};

startMonitoringLoop(checkResults, getCheckResultsInterval);

// 低頻度タスク：データ同期（6時間ごと）
startMonitoringLoop(syncData, () => 6 * 60 * 60 * 1000);

// Webhook署名検証エラー用のエラーハンドリングミドルウェア
// ※ 全ルート定義より後に配置すること
app.use((err, req, res, next) => {
  if (req.path === '/' && req.method === 'POST') {
    console.error('[LINE] Signature validation or middleware error:', err.message || err);
    return res.status(200).end();
  }
  console.error('[HTTP] Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
