const crypto = require('crypto');
const db = require('../db');
const { encrypt, decrypt } = require('./crypto');

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5分

/**
 * 認証用ワンタイムトークンを生成
 * @param {string} userId - LINE User ID
 * @returns {string} - トークン
 */
function createAuthToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  db.prepare(
    'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);

  return token;
}

/**
 * トークンを検証し、有効ならuserIdを返す（使用済み・期限切れは無効）
 * @param {string} token
 * @returns {string|null} - 有効な場合はuserId
 */
function validateToken(token) {
  const row = db.prepare(
    'SELECT user_id, expires_at, used FROM auth_tokens WHERE token = ?'
  ).get(token);

  if (!row || row.used || Date.now() > row.expires_at) {
    return null;
  }
  return row.user_id;
}

/**
 * トークンを使用済みにする
 * @param {string} token
 */
function consumeToken(token) {
  db.prepare('UPDATE auth_tokens SET used = 1 WHERE token = ?').run(token);
}

/**
 * ユーザーのAPIキーを暗号化して保存
 * @param {string} userId
 * @param {string} apiKey
 */
function saveApiKey(userId, apiKey) {
  const { encrypted, iv, authTag } = encrypt(apiKey);
  db.prepare(
    `INSERT INTO user_api_keys (user_id, encrypted_key, iv, auth_tag, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       encrypted_key = excluded.encrypted_key,
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       updated_at = CURRENT_TIMESTAMP`
  ).run(userId, encrypted, iv, authTag);
}

/**
 * ユーザーのAPIキーを取得（復号）
 * @param {string} userId
 * @returns {string|null}
 */
function getApiKey(userId) {
  const row = db.prepare(
    'SELECT encrypted_key, iv, auth_tag FROM user_api_keys WHERE user_id = ?'
  ).get(userId);

  if (!row) return null;

  try {
    return decrypt(row.encrypted_key, row.iv, row.auth_tag);
  } catch (err) {
    console.error('[Auth] Failed to decrypt API key:', err);
    return null;
  }
}

module.exports = {
  createAuthToken,
  validateToken,
  consumeToken,
  saveApiKey,
  getApiKey
};
