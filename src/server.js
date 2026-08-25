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

const { syncData, checkResults } = require('./lib/monitor');

// 高頻度タスク：結果チェック（30秒ごと）
setInterval(checkResults, 30 * 1000);

// 低頻度タスク：データ同期（30分ごと）
setInterval(syncData, 30 * 60 * 1000);

// 即時初回実行
syncData();
checkResults();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
