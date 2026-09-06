// Scraper用のレート制限を管理する（メモリベース・シンプル版）
// 失敗時のカウント問題を回避するため、単純な「最小リクエスト間隔」方式を採用

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 3000; // リクエスト間隔は最低3秒空ける（1分20回相当だが、安全マージン込み）

/**
 * レート制限をチェックし、必要であれば待機するPromiseを返す
 * @param {number} _limitPerMinute - 互換性のために残すが無視される
 * @returns {Promise<void>} 待機が必要な場合は解決後に返る
 */
const scraperRateLimit = async (_limitPerMinute = 10) => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  
  if (elapsed < MIN_INTERVAL_MS) {
    const waitTime = MIN_INTERVAL_MS - elapsed;
    // デバッグログは出さない（ノイズになるため）
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
};

module.exports = scraperRateLimit;
