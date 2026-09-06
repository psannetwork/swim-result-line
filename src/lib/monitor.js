const db = require('./db/index');
const { getGames } = require('./scraper/main');
const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');
const { SwimLiveScraper } = require('swim-live-scraper');
const { isResultNotified, saveResultNotification } = require('./db/resultStore');
const { sendLineNotification } = require('./notify');
const { buildResultFlexMessage } = require('./messageBuilder');
const scraperRateLimit = require('./scraperRateLimit');

// HTMLレスポンスがJSONパースエラーとして返ってくるか判定
function isHtmlResponseError(err) {
  const msg = err?.message || '';
  return msg.includes('Unexpected token') && msg.includes('<');
}

async function withRetry(fn, retries = 3, initialDelay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      // レート制限は関数実行前に外部で制御するため、ここでは純粋なリトライのみ行う
      return await fn();
    } catch (err) {
      // 403 または HTMLレスポンスエラー（実質的なブロック/メンテ）の場合
      if ((err.message && err.message.includes('403')) || (err.status === 403) || isHtmlResponseError(err)) {
        const reason = isHtmlResponseError(err) ? 'HTML response (likely block/maintenance)' : '403 Forbidden';
        console.error(`[MONITOR] ${reason} detected! Backing off for 2 hours.`);
        await new Promise(resolve => setTimeout(resolve, 2 * 60 * 60 * 1000));
        continue; 
      }
      if (i === retries - 1) throw err;
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`[MONITOR] Attempt ${i + 1} failed (${err.message}), retrying in ${delay}ms...`);
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

        if (!nextRace) return 6 * 60 * 60 * 1000; // 6時間

        if (nextRace.start_time) {
            const [h, m] = nextRace.start_time.split(':');
            const startTime = new Date();
            startTime.setHours(h, m, 0, 0);

            const diffMinutes = (startTime - new Date()) / (1000 * 60);

            // 進行中、または遅延している、あるいは2分以内の場合は3分間隔
            if (diffMinutes < 2) return 3 * 60 * 1000; 
            
            // 15分前までなら15分間隔
            if (diffMinutes < 15) return 15 * 60 * 1000;
            
            // それ以上先なら1時間間隔
            return 60 * 60 * 1000;
        }

        return 60 * 60 * 1000; // 推定（1時間）
    } catch (err) {
        console.error(`[MONITOR] Interval calculation error:`, err);
        return 5 * 60 * 1000;
    }
}

async function syncData() {
  console.log('[MONITOR] Running data sync...');
  await scraperRateLimit();
  const games = await withRetry(() => getGames());
  const insertGame = db.prepare('INSERT OR REPLACE INTO games (game_code, game_name, period, status_label, last_updated) VALUES (?, ?, ?, ?, ?)');
  const insertRace = db.prepare('INSERT OR IGNORE INTO races (game_code, program_id, heat, race_name) VALUES (?, ?, ?, ?)');

  for (const game of games) {
    insertGame.run(game.game_code, game.game_name, game.period, game.status_label, Date.now());
    const datePart = game.period.split(' ')[0].replace('.', '-');
    const fullDate = `2026-${datePart}`;
    
    try {
        await scraperRateLimit();
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
  console.log('[MONITOR] Running smart results check (Event-driven approach)...');
  
  // 1. 登録選手をメモリにロード（ローカルマッチング用）
  const athletes = db.prepare('SELECT id, name, user_id FROM athletes').all();
  if (athletes.length === 0) {
      console.log('[MONITOR] No athletes registered. Skipping.');
      return;
  }
  
  // 名前検索用の正規表現マップを作成（パフォーマンス最適化）
  const athleteMatchers = athletes.map(a => ({
      ...a,
      normalizedName: a.name.replace(/\s+/g, ''),
      regex: new RegExp(a.name.replace(/\s+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }));

  // 2. 開催中の大会を取得
  let games;
  try {
      games = await withRetry(() => getGames());
  } catch (e) {
      console.error('[MONITOR] Failed to get games list:', e);
      return;
  }

  // アクティブな大会（開催中など）に絞り込む
  // status_label に "開催中" や "Finished" などが含まれる想定
  // ここではシンプルに全大会を対象とするが、過去の日付のものはスキップするなどのフィルタを入れても良い
  const activeGames = games.filter(g => {
      // 簡易的なアクティブ判定: period が現在を含む、または status が開催中
      // 厳密には日付パースが必要だが、まずは全件試してエラーハンドリングに任せるか、
      // 直近のものだけにする等の戦略が取れる。
      // 今回は「全大会」対象としつつ、APIコール削減のため「未通知レースがあるかどうか」で制御する。
      return true; 
  });

  const gameMap = new Map(games.map(g => [g.game_code, g]));

  for (const game of activeGames) {
      // 大会ごとの処理
      // レート制限を考慮し、大会ごとに少しウェイトを入れることも検討できるが、
      // withRetry 内のレート制限チェックに任せる。
      
      // 日付の解析（syncDataと同様のロジック）
      // period例: "2026.08.25-2026.08.27" -> 開始日を使用
      const datePart = game.period ? game.period.split(' ')[0].split('-')[0].replace(/\./g, '-') : null;
      if (!datePart) continue;
      const fullDate = `2026-${datePart}`; // 年固定は良くないが既存コード踏襲

      try {
          // レース一覧取得
          // キャッシュ（DB）を使いたいが、リアルタイム性重視なのでAPIから取る。
          // ただし、毎回取るのは無駄なので、本来は syncData の結果を使うべき。
          // ここではAPIコール数を減らすため、syncDataで入った races テーブルを活用する方針に変更したいが、
          // monitor.js 単体での完結性を保つため、まずはAPIから取得しつつ、
          // 「結果が出ているレース」だけをターゲットにする。
          
          // 最適化: getRaceListByGameDate も重いので、DBのracesテーブルから
          // 「この大会のレース一覧」を取得するように変更する。
          // syncData が定期的に走っている前提。
          const racesFromDb = db.prepare('SELECT program_id, heat, race_name FROM races WHERE game_code = ?').all(game.game_code);
          
          let racesToCheck = [];
          if (racesFromDb && racesFromDb.length > 0) {
              racesToCheck = racesFromDb;
          } else {
              // DBにない場合のみAPIフォールバック
              console.log(`[MONITOR] No races in DB for ${game.game_code}, fetching from API...`);
              await scraperRateLimit();
              racesToCheck = await withRetry(() => SwimLiveScraper.getRaceListByGameDate(game.game_code, fullDate));
          }

          for (const race of racesToCheck) {
              // ヒート番号がない場合はスキップ（予選決勝まとめてる場合などあるが、基本はあるはず）
              if (!race.heat) continue;

              const raceIdentifier = `${game.game_code}_${race.program_id}_${race.heat}`;
              
              // 既に通知済みならスキップ（これが最重要フィルター）
              if (await isResultNotified(raceIdentifier)) continue;

              // レース結果取得
              // ここで初めて重い getRaceResults を呼ぶ
              let entryList;
              try {
                  await scraperRateLimit();
                  entryList = await withRetry(() => LiveApi.getRaceResults(game.game_code, race.program_id, race.heat, 9));
              } catch (e) {
                  console.warn(`[MONITOR] Failed to get results for ${raceIdentifier}: ${e.message}`);
                  continue;
              }

              if (!entryList || !Array.isArray(entryList)) continue;

              // ローカルマッチング: 登録選手が含まれているか確認
              // 全選手に対してループを回すが、APIコールではないので高速
              for (const athlete of athleteMatchers) {
                  const foundParticipant = entryList.find(e => {
                      const names = [e.swimmer_name, e.swimmer1_name, e.swimmer2_name, e.swimmer3_name, e.swimmer4_name];
                      return names.some(n => n && n.replace(/\s+/g, '').includes(athlete.normalizedName));
                  });

                  if (foundParticipant && foundParticipant.result_time) {
                      // マッチ！通知処理
                      const raceName = race.race_name || `${foundParticipant.gender_name || ''}${foundParticipant.distance_name || ''}${foundParticipant.swimming_style_name || ''}`;
                      
                      const flexMessage = buildResultFlexMessage({
                          meetName: game.game_name,
                          raceTitle: raceName,
                          heat: race.heat,
                          results: entryList,
                          targetSwimmerName: athlete.name,
                      });

                      await sendLineNotification(athlete.user_id, flexMessage);
                      console.log(`[Result] Notified user ${athlete.user_id} for race: ${raceIdentifier} (${game.game_name} - ${raceName}, Time: ${foundParticipant.result_time})`);
                  }
              }
              
              // マッチしたかどうかに関わらず、結果が取得できた（＝レースが終わっている）なら通知済みにマーク
              // これにより次回以降このレースのAPIコールは発生しない
              await saveResultNotification(raceIdentifier);
          }

      } catch (err) {
          console.error(`[MONITOR] Error processing game ${game.game_code}:`, err);
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
