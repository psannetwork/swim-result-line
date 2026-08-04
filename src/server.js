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

// Periodic task (check every minute)
setInterval(async () => {
  console.log('Running dynamic background job...');
  const games = await getGames();
  const inProgressGames = games.filter(g => g.status_label === '開催中');
  const athletes = db.prepare('SELECT * FROM athletes').all();
  
  if (athletes.length === 0 || inProgressGames.length === 0) return;

  for (const game of inProgressGames) {
      const datePart = game.period.split(' ')[0].replace('.', '-');
      const fullDate = `2026-${datePart}`;
      
      try {
        // 大会ごとのレース一覧を取得
        const raceList = await require('swim-live-scraper').SwimLiveScraper.getRaceListByGameDate(game.game_code, fullDate);
        
        for (const athlete of athletes) {
            // 選手が出場するレースを特定
            const athleteRaces = raceList.filter(r => r.race_name.includes(athlete.name)); // 簡易フィルタリング
            
            for (const race of athleteRaces) {
                // レース結果を取得（タイムがあれば通知）
                const results = await require('swim-live-scraper').SwimLiveScraper.getRaceResults(race.race_code);
                const athleteResult = results.find(r => r.swimmer_name === athlete.name && r.time);
                
                if (athleteResult) {
                    // 通知済みか確認
                    const notified = db.prepare('SELECT 1 FROM notifications WHERE athlete_id = ? AND race_code = ?').get(athlete.id, race.race_code);
                    if (notified) continue;

                    await client.pushMessage({
                        to: athlete.user_id,
                        messages: [{
                            type: 'text',
                            text: `【速報】${game.game_name}\n${athlete.name} 選手: ${athleteResult.time}`
                        }]
                    });
                    
                    db.prepare('INSERT INTO notifications (athlete_id, race_code, notified_at) VALUES (?, ?, ?)')
                      .run(athlete.id, race.race_code, Date.now());
                }
            }
        }
      } catch (err) {
          console.error(`Error processing game ${game.game_code}:`, err);
      }
  }
}, 60 * 1000); // 1分間隔に変更

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
