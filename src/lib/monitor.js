const db = require('./db/index');
const { getGames } = require('./scraper/main');
const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');
const { SwimLiveScraper } = require('swim-live-scraper');
const { isResultNotified, saveResultNotification } = require('./db/resultStore');
const { sendLineNotification } = require('./notify');
const { buildResultFlexMessage } = require('./messageBuilder');

async function withRetry(fn, retries = 3, initialDelay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`[MONITOR] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 低頻度タスク：大会リストとレースリストの同期
async function syncData() {
  console.log('[MONITOR] Running data sync...');
  const games = await withRetry(() => getGames());
  const insertGame = db.prepare('INSERT OR REPLACE INTO games (game_code, game_name, period, status_label, last_updated) VALUES (?, ?, ?, ?, ?)');
  const insertRace = db.prepare('INSERT OR IGNORE INTO races (game_code, program_id, heat, race_name) VALUES (?, ?, ?, ?)');

  for (const game of games) {
    insertGame.run(game.game_code, game.game_name, game.period, game.status_label, Date.now());
    const datePart = game.period.split(' ')[0].replace('.', '-');
    const fullDate = `2026-${datePart}`;
    
    try {
        const raceList = await withRetry(() => SwimLiveScraper.getRaceListByGameDate(game.game_code, fullDate));
        for (const race of raceList) {
            insertRace.run(game.game_code, race.program_id, race.heat, race.race_name);
        }
    } catch (err) {
        console.error(`[MONITOR] Error syncing races for game ${game.game_code}:`, err);
    }
  }
}

// 高頻度タスク：レース結果の確定通知
async function checkResults() {
  console.log('[MONITOR] Running high-frequency results check...');
  
  // 1. 登録選手リストを取得
  const athletes = db.prepare('SELECT name, user_id FROM athletes').all();
  
  // 大会一覧を事前に取得してキャッシュ
  const games = await withRetry(() => getGames());
  const gameMap = new Map(games.map(g => [g.game_code, g.game_name]));

  // 選手ごとにレース結果を検索して通知
  for (const athlete of athletes) {
    try {
        // 2. 選手名で全大会を横断検索
        const foundRaces = await withRetry(() => SwimLiveScraper.searchAthleteAcrossGames(athlete.name));
        
        if (!foundRaces || foundRaces.length === 0) continue;

        for (const race of foundRaces) {
            // レース名の構築と大会名の補完
            const gameName = gameMap.get(race.game_code) || '大会名不明';
            const raceName = `${race.gender_name || ''}${race.distance_name || ''}${race.swimming_style_name || ''} (${race.race_division_name || ''})`;

            // 二重通知チェック
            const raceIdentifier = `${race.game_code}_${race.program_id}_${race.heat}`;
            if (await isResultNotified(raceIdentifier)) continue;

            // 3. レース結果APIを呼び出し (Status 9 = 結果確定)
            const entryList = await withRetry(() => LiveApi.getRaceResults(race.game_code, race.program_id, race.heat, 9));
            
            if (!entryList || !Array.isArray(entryList)) continue;

            const normalizedTargetName = athlete.name.replace(/\s+/g, '');
            const foundParticipant = entryList.find(e => {
                const names = [e.swimmer_name, e.swimmer1_name, e.swimmer2_name, e.swimmer3_name, e.swimmer4_name];
                return names.some(n => n && n.replace(/\s+/g, '').includes(normalizedTargetName));
            });

            // 参加者が見つからない、またはタイム（result_time）がない場合は通知しない
            if (!foundParticipant || !foundParticipant.result_time) continue;

            // メッセージ構築
            const flexMessage = buildResultFlexMessage({
                meetName: gameName,
                raceTitle: raceName,
                heat: race.heat,
                results: entryList,
                targetSwimmerName: athlete.name,
            });

            // デバッグ：生成されたJSONを確認
            console.log(JSON.stringify(flexMessage, null, 2));

            // 通知
            await sendLineNotification(athlete.user_id, flexMessage);

            // DB記録
            await saveResultNotification(raceIdentifier);
            console.log(`[Result] Notified user ${athlete.user_id} for race: ${raceIdentifier} (${gameName} - ${raceName}, Time: ${foundParticipant.result_time})`);
        }
    } catch (err) {
        console.error(`[MONITOR] Error checking results for athlete ${athlete.name}:`, err);
    }
  }
}

module.exports = { syncData, checkResults };
