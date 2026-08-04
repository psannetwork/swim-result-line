const { messagingApi } = require('@line/bot-sdk');
const db = require('../db');
const rateLimit = require('../rateLimit');
const { getGames } = require('../scraper/main');

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

async function withTimeout(promise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Scraper request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

async function handleEvent(event) {
  console.log('LINE Webhook received');
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const text = event.message.text;
  const replyToken = event.replyToken;
  const userId = event.source.userId || event.source.groupId || event.source.roomId;

  if (!rateLimit(userId)) {
    return client.replyMessage({
        replyToken: replyToken,
        messages: [{ type: 'text', text: 'レート制限を超えました。' }]
    });
  }

  try {
      if (text.startsWith('/add')) {
          const athleteId = text.split(' ')[1];
          db.prepare('INSERT INTO athletes (id, name, user_id) VALUES (?, ?, ?)').run(athleteId, athleteId, userId);
          return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: `Registered athlete ${athleteId}` }]
          });
      }

      if (text.startsWith('/delete')) {
          const athleteId = text.split(' ')[1];
          db.prepare('DELETE FROM athletes WHERE id = ? AND user_id = ?').run(athleteId, userId);
          return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: `Deleted athlete ${athleteId}` }]
          });
      }

      if (text.startsWith('/search')) {
        const parts = text.split(' ');
        const athleteName = parts[1];

        if (!athleteName) {
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '選手名を入力してください。\n例: /search 大橋' }]
            });
        }

        try {
            const results = await require('swim-live-scraper').SwimLiveScraper.searchAthletes({ name: athleteName });
            
            if (!results || !results.data || results.data.length === 0) {
                return await client.replyMessage({
                    replyToken: replyToken,
                    messages: [{ type: 'text', text: '該当する選手が見つかりませんでした。' }]
                });
            }

            const athleteList = results.data.slice(0, 5).map(a => 
                `・${a.swimmer_name} (ID: ${a.swimmer_code})\n  所属: ${a.entry_group?.name || '不明'}\n  団体: ${a.entry_group?.member_group?.name || '不明'}\n  性別: ${a.gender?.name || '不明'}`
            ).join('\n\n');
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: `検索結果（上位5名）:\n${athleteList}` }]
            });
        } catch (err) {
            console.error('[DEBUG] Error in search command:', err);
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '選手検索中にエラーが発生しました。' }]
            });
        }
      }

      if (text.startsWith('/game')) {
        const parts = text.split(' ');
        const subCommand = parts[1];

        if (subCommand === 'list') {
          const gameCode = parts[2];
          if (!gameCode) {
            return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: '大会コードを指定してください。\n例: /game list 2126131' }]
            });
          }
          
          try {
            const games = await require('../scraper/main').getGames(); 
            const game = games.find(g => g.game_code === gameCode);
            if (!game) return;

            const datePart = game.period.split(' ')[0].split('(')[0].replace('.', '-');
            const fullDate = `2026-${datePart}`;
            
            const raceList = await withTimeout(require('swim-live-scraper').SwimLiveScraper.getRaceListByGameDate(gameCode, fullDate));
            const raceNames = [...new Set(raceList.map(r => r.race_name))];
            
            return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: `種目一覧:\n${raceNames.join('\n')}` }]
            });
          } catch (err) {
            console.error('[DEBUG] Error in list command:', err);
             return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '種目一覧の取得中にエラーが発生しました。' }]
            });
          }
        } else {
          const games = await require('../scraper/main').getGames(); 
          const gameList = games.map(g => `${g.game_name} (${g.game_code})`).join('\n');
          return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: `大会一覧:\n${gameList}` }]
          });
        }
        return;
      }

      if (text.startsWith('/help')) {
        return await client.replyMessage({
            replyToken: replyToken,
            messages: [{
                type: 'text',
                text: '利用可能なコマンド:\n/add {選手ID}\n/delete {選手ID}\n/game\n/game list {大会ID}\n/search {選手名}\n/help'
            }]
        });
      }

      // コマンド以外は無視
      return;
  } catch (err) {
      console.error('Error in handleEvent:', err);
  }
}

module.exports = handleEvent;