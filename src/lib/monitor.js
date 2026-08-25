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

// レースリストから次回までの最適インターバルを算出
async function calculateNextInterval(gameCode, date) {
    try {
        const raceList = await withRetry(() => SwimLiveScraper.getRaceListByGameDate(gameCode, date));
        const sortedRaces = raceList.sort((a, b) => parseInt(a.program_id) - parseInt(b.program_id));
        const nextRace = sortedRaces.find(r => !r.is_finished);

        if (!nextRace) return 60 * 60 * 1000; // 1時間

        if (nextRace.start_time) {
            const [h, m] = nextRace.start_time.split(':');
            const startTime = new Date();
            startTime.setHours(h, m, 0, 0);

            const diffMinutes = (startTime - new Date()) / (1000 * 60);

            // 進行中、または遅延している、あるいは2分以内の場合は30秒間隔
            if (diffMinutes < 2) return 30 * 1000; 
            
            // 15分前までなら1分間隔
            if (diffMinutes < 15) return 60 * 1000;
            
            // それ以上先なら3分間隔
            return 3 * 60 * 1000;
        }

        return 2 * 60 * 1000; // 推定
    } catch (err) {
        console.error(`[MONITOR] Interval calculation error:`, err);
        return 5 * 60 * 1000;
    }
}

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

async function checkResults() {
  console.log('[MONITOR] Running high-frequency results check...');
  
  const athletes = db.prepare('SELECT name, user_id FROM athletes').all();
  const games = await withRetry(() => getGames());
  const gameMap = new Map(games.map(g => [g.game_code, g.game_name]));

  for (const athlete of athletes) {
    try {
        const foundRaces = await withRetry(() => SwimLiveScraper.searchAthleteAcrossGames(athlete.name));
        
        if (!foundRaces || foundRaces.length === 0) continue;

        for (const race of foundRaces) {
            const gameName = gameMap.get(race.game_code) || '大会名不明';
            const raceName = `${race.gender_name || ''}${race.distance_name || ''}${race.swimming_style_name || ''} (${race.race_division_name || ''})`;

            const raceIdentifier = `${race.game_code}_${race.program_id}_${race.heat}`;
            if (await isResultNotified(raceIdentifier)) continue;

            const entryList = await withRetry(() => LiveApi.getRaceResults(race.game_code, race.program_id, race.heat, 9));
            
            if (!entryList || !Array.isArray(entryList)) continue;

            const normalizedTargetName = athlete.name.replace(/\s+/g, '');
            const foundParticipant = entryList.find(e => {
                const names = [e.swimmer_name, e.swimmer1_name, e.swimmer2_name, e.swimmer3_name, e.swimmer4_name];
                return names.some(n => n && n.replace(/\s+/g, '').includes(normalizedTargetName));
            });

            if (!foundParticipant || !foundParticipant.result_time) continue;

            const flexMessage = buildResultFlexMessage({
                meetName: gameName,
                raceTitle: raceName,
                heat: race.heat,
                results: entryList,
                targetSwimmerName: athlete.name,
            });

            await sendLineNotification(athlete.user_id, flexMessage);
            await saveResultNotification(raceIdentifier);
            console.log(`[Result] Notified user ${athlete.user_id} for race: ${raceIdentifier} (${gameName} - ${raceName}, Time: ${foundParticipant.result_time})`);
        }
    } catch (err) {
        console.error(`[MONITOR] Error checking results for athlete ${athlete.name}:`, err);
    }
  }
}

async function startMonitoringLoop(task, getInterval) {
    while (true) {
        const start = Date.now();
        try {
            await task();
        } catch (err) {
            console.error(`[MONITOR] Task error:`, err);
            await new Promise(r => setTimeout(r, 60 * 1000));
            continue;
        }
        
        const interval = await getInterval(); 
        console.log(`[MONITOR] Next task in ${interval}ms`);
        await new Promise(r => setTimeout(r, interval));
    }
}

module.exports = { syncData, checkResults, startMonitoringLoop, calculateNextInterval };
