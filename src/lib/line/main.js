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
          const athleteCode = text.split(' ')[1];
          if (!athleteCode) {
              return await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '選手IDを入力してください。\n例: /add 1234567' }] });
          }
          
          // IDは数値のみであるかチェック
          if (!/^\d+$/.test(athleteCode)) {
              return await client.replyMessage({ 
                replyToken, 
                messages: [{ type: 'text', text: '選手IDは数字で入力してください。\n選手名からIDを検索したい場合は `/search 選手名` を先に実行してください。' }] 
              });
          }

          try {
              const { SwimLiveScraper } = require('swim-live-scraper');
              
              // 修正: まず直接 swimmerCode で取得を試みる (404 になる場合のみ変換を試すなど戦略を再考する必要あり)
              // ここでは、一旦 swimmerCode をそのまま API ID として試すか、あるいはエラーハンドリングを強化する
              let athleteData;
              try {
                  athleteData = await SwimLiveScraper.getAthleteDetails(athleteCode);
              } catch (e) {
                  // 直接取得に失敗したら変換を試みる
                  const apiId = SwimLiveScraper.swimmerCodeToApiId(athleteCode);
                  athleteData = await SwimLiveScraper.getAthleteDetails(apiId);
              }
              
              if (!athleteData || !athleteData.swimmer_name) {
                  return await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '指定された選手IDの選手が見つかりませんでした。' }] });
              }

              db.prepare('INSERT OR REPLACE INTO athletes (id, name, user_id) VALUES (?, ?, ?)').run(athleteCode, athleteData.swimmer_name, userId);
              
              return await client.replyMessage({
                  replyToken: replyToken,
                  messages: [{ type: 'text', text: `以下の選手を登録しました:\n${athleteData.swimmer_name} (ID: ${athleteCode})` }]
              });
          } catch (err) {
              console.error('Error adding athlete:', err);
              return await client.replyMessage({ replyToken, messages: [{ type: 'text', text: '選手登録中にエラーが発生しました。IDが正しいか確認してください。' }] });
          }
      }

      if (text.startsWith('/delete')) {
          const athleteId = text.split(' ')[1];
          db.prepare('DELETE FROM athletes WHERE id = ? AND user_id = ?').run(athleteId, userId);
          return await client.replyMessage({
              replyToken: replyToken,
              messages: [{ type: 'text', text: `Deleted athlete ${athleteId}` }]
          });
      }

      if (text.startsWith('/searchGames')) {
        const parts = text.split(' ');
        const searchTerm = parts[1];

        if (!searchTerm) {
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '選手名または選手IDを入力してください。\n例: /searchGames 寺本 または /searchGames 8939181' }]
            });
        }

        try {
            const Scraper = require('swim-live-scraper').SwimLiveScraper;
            const games = await Scraper.getGames();
            const isId = /^\d+$/.test(searchTerm);
            
            let results;
            if (isId) {
                // Workaround: Get athlete details to get the name, then search by name
                const details = await Scraper.getAthleteDetails(searchTerm);
                if (details && details.swimmer_name) {
                    results = await Scraper.searchAthleteAcrossGames(details.swimmer_name);
                } else {
                    results = [];
                }
            } else {
                results = await Scraper.searchAthleteAcrossGames(searchTerm);
            }
            
            if (!results || results.length === 0) {
                return await client.replyMessage({
                    replyToken: replyToken,
                    messages: [{ type: 'text', text: `「${searchTerm}」さんの参加情報は見つかりませんでした。` }]
                });
            }

            // 大会名が欠落している場合があるため、ゲーム一覧から補完
            const enrichedResults = results.map(r => {
                const game = games.find(g => g.game_code === r.game_code);
                return {
                    ...r,
                    game_name: game ? game.game_name : r.game_name || '大会名不明'
                };
            });

            // レース情報を見やすくフォーマット
            const raceList = enrichedResults.slice(0, 5).map(r => 
                `・${r.game_name}\n  ${r.distance}${r.swimming_style_name} (${r.race_division_name || ''})\n  ${r.heat}組 ${r.lane}レーン`
            ).join('\n\n');
            
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: `「${searchTerm}」さんの参加レース情報（最新5件）:\n\n${raceList}` }]
            });
        } catch (err) {
            console.error('[DEBUG] Error in searchGames command:', err);
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '参加レース情報取得中にエラーが発生しました。' }]
            });
        }
      }

      if (text.startsWith('/search')) {
        const parts = text.split(' ');
        // /search 以降すべてを選手名として扱う
        const athleteName = parts.slice(1).join(' ');

        if (!athleteName) {
            return await client.replyMessage({
                replyToken: replyToken,
                messages: [{ type: 'text', text: '選手名を入力してください。\n例: /search 選手名' }]
            });
        }

        try {
            const { SwimLiveScraper } = require('swim-live-scraper');
            const results = await SwimLiveScraper.searchAthletes({ name: athleteName });
            
            if (!results || !results.data || results.data.length === 0) {
                return await client.replyMessage({
                    replyToken: replyToken,
                    messages: [{ type: 'text', text: '該当する選手が見つかりませんでした。' }]
                });
            }

            // 重複排除 (swimmer_codeが同じものはまとめる)
            const uniqueAthletes = [];
            const codes = new Set();
            for (const a of results.data) {
                if (!codes.has(a.swimmer_code)) {
                    uniqueAthletes.push(a);
                    codes.add(a.swimmer_code);
                }
            }

            const athleteList = uniqueAthletes.slice(0, 5).map(a => 
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
                text: '利用可能なコマンド:\n/add {選手ID}\n/delete {選手ID}\n/game\n/game list {大会ID}\n/search {選手名}\n/searchGames {選手名}\n/help'
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