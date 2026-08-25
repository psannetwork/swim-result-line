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

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.post('/', middleware(config), async (req, res) => {
  console.log('[LINE] Webhook received');

  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('[LINE] Webhook error:', err);
    res.status(500).end();
  }
});

app.get('/', (req, res) => {
  res.send('LINE Bot is running!');
});

const { syncData, checkResults, startMonitoringLoop, calculateNextInterval } = require('./lib/monitor');

// 動的スケジューリングの開始
// 高頻度タスク：結果チェック
const getCheckResultsInterval = async () => {
    const games = await getGames();
    const activeGame = games.find(g => g.status_label === '開催中');
    if (!activeGame) return 60 * 60 * 1000; // 1時間

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
