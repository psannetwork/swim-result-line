const { GoogleGenerativeAI } = require('@google/generative-ai');
const { SwimLiveScraper } = require('swim-live-scraper');
const NodeCache = require('node-cache');
const db = require('../db');

// 会話履歴のキャッシュ (TTL: 30分)
const chatCache = new NodeCache({ stdTTL: 1800 });

// ツール定義: swim-live-scraper の主要機能
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'getGames',
        description: '開催中・予定の水泳大会一覧を取得します。大会名、コード、期間、ステータスが含まれます。',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'getGameDetails',
        description: '指定された大会コードの詳細情報を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            gameCode: { type: 'STRING', description: '大会コード (例: "2126131")' }
          },
          required: ['gameCode']
        }
      },
      {
        name: 'getRaceListByGameDate',
        description: '指定した大会・日付のレース（種目）一覧を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            gameCode: { type: 'STRING', description: '大会コード' },
            date: { type: 'STRING', description: '日付 (YYYY-MM-DD形式)' }
          },
          required: ['gameCode', 'date']
        }
      },
      {
        name: 'getRaceResults',
        description: '指定したレースの結果（順位、タイム、選手名など）を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            gameCode: { type: 'STRING', description: '大会コード' },
            programId: { type: 'STRING', description: 'プログラムID（種目番号）' },
            heat: { type: 'STRING', description: 'ヒート番号（予選=1, 決勝=4 など）' }
          },
          required: ['gameCode', 'programId', 'heat']
        }
      },
      {
        name: 'getAthleteDetails',
        description: '選手コードから選手の詳細情報（名前、所属、性別など）を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            swimmerCode: { type: 'STRING', description: '選手コード（数字）' }
          },
          required: ['swimmerCode']
        }
      },
      {
        name: 'searchAthletes',
        description: '選手を検索します。名前、ID、所属コード、学年、性別などで絞り込み可能です。所属コードが不明な場合は、まず該当所属の選手を1名検索してコードを取得してください。',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: '選手名（部分一致可）' },
            id: { type: 'STRING', description: '選手ID（数字）' },
            member_group_code: { type: 'INTEGER', description: '所属団体コード（例: 大学やクラブのコード）' },
            entry_group_name: { type: 'STRING', description: '所属団体名（例: "静岡大学"）。名前で所属検索する場合に使用。' },
            school_class_code: { type: 'INTEGER', description: '学年コード (1:小学, 2:中学, 3:高校, 4:大学 など)' },
            gender_code: { type: 'INTEGER', description: '性別コード (1:男子, 2:女子, 3:混合)' }
          }
        }
      },
      {
        name: 'searchAthleteAcrossGames',
        description: '選手名または選手IDで複数の大会を横断して参加情報を検索します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: '選手名（部分一致可）。名前がわかる場合はこちらを使用。' },
            swimmerCode: { type: 'STRING', description: '選手ID（数字）。IDがわかる場合はこちらを使用。' }
          },
          // 少なくとも一方が必要だが、スキーマ上は両方任意とし、実行時またはAIの判断に委ねる
        }
      },
      {
        name: 'getAthleteBestRecord',
        description: '選手の特定種目のベスト記録を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            swimmerCode: { type: 'STRING', description: '選手コード' },
            waterwayCode: { type: 'INTEGER', description: '水路コード (1:長水路, 2:短水路)' },
            styleCode: { type: 'INTEGER', description: '泳法コード (1:自由形, 2:背泳ぎ, 3:平泳ぎ, 4:バタフライ, 5:個人メドレー)' },
            distanceCode: { type: 'INTEGER', description: '距離コード (2:50m, 3:100m, 4:200m など)' }
          },
          required: ['swimmerCode', 'waterwayCode', 'styleCode', 'distanceCode']
        }
      },
      {
        name: 'getMemberGroupGames',
        description: '特定の団体（連盟など）に所属する大会一覧を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            groupId: { type: 'INTEGER', description: '団体ID (例: 1)' }
          },
          required: ['groupId']
        }
      },
      {
        name: 'getRaceHeatsListByGameDate',
        description: '指定した大会・日付のレースヒート一覧を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            gameCode: { type: 'STRING', description: '大会コード' },
            date: { type: 'STRING', description: '日付 (YYYY-MM-DD形式)' }
          },
          required: ['gameCode', 'date']
        }
      },
      {
        name: 'getAthleteBestFinaPoints',
        description: '選手のFINAポイント情報を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            swimmerCode: { type: 'STRING', description: '選手コード' },
            year: { type: 'INTEGER', description: '対象年 (例: 2026)' },
            waterwayCode: { type: 'INTEGER', description: '水路コード (1:長水路, 2:短水路)' }
          },
          required: ['swimmerCode', 'year', 'waterwayCode']
        }
      },
      {
        name: 'getAthleteSwimedRaces',
        description: '選手の泳法別成績（出場種目一覧）を取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            swimmerCode: { type: 'STRING', description: '選手コード' },
            waterwayCode: { type: 'INTEGER', description: '水路コード (1:長水路, 2:短水路)' },
            styleCode: { type: 'INTEGER', description: '泳法コード (1:自由形, 2:背泳ぎ, 3:平泳ぎ, 4:バタフライ, 5:個人メドレー)' }
          },
          required: ['swimmerCode', 'waterwayCode', 'styleCode']
        }
      },
      {
        name: 'getAthleteGraphs',
        description: '選手の種目別記録推移グラフデータを取得します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            swimmerCode: { type: 'STRING', description: '選手コード' },
            waterwayCode: { type: 'INTEGER', description: '水路コード (1:長水路, 2:短水路)' },
            styleCode: { type: 'INTEGER', description: '泳法コード (1:自由形, 2:背泳ぎ, 3:平泳ぎ, 4:バタフライ, 5:個人メドレー)' },
            distanceCode: { type: 'INTEGER', description: '距離コード (2:50m, 3:100m, 4:200m など)' }
          },
          required: ['swimmerCode', 'waterwayCode', 'styleCode', 'distanceCode']
        }
      },
      {
        name: 'addAthlete',
        description: '選手を通知リストに登録します。選手IDが必要です。',
        parameters: {
          type: 'OBJECT',
          properties: {
            athleteId: { type: 'STRING', description: '選手ID（数字）' }
          },
          required: ['athleteId']
        }
      },
      {
        name: 'deleteAthlete',
        description: '登録した選手を削除します。選手IDまたは "all" を指定します。',
        parameters: {
          type: 'OBJECT',
          properties: {
            athleteId: { type: 'STRING', description: '選手ID、または全て削除する場合は "all"' }
          },
          required: ['athleteId']
        }
      },
      {
        name: 'listAthletes',
        description: '現在登録されている選手の一覧を表示します。',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }
];

// ツール実行ハンドラ
async function executeToolCall(functionCall, contextId) {
  const { name, args } = functionCall;
  console.log(`[AI Agent] Executing tool: ${name} for user/group: ${contextId}`, args);

  try {
    let result;
    switch (name) {
      case 'getGames':
        result = await SwimLiveScraper.getGames();
        break;
      case 'getGameDetails':
        result = await SwimLiveScraper.getGameDetails(args.gameCode);
        break;
      case 'getRaceListByGameDate':
        result = await SwimLiveScraper.getRaceListByGameDate(args.gameCode, args.date);
        break;
      case 'getRaceResults':
        result = await SwimLiveScraper.getRaceResults(args.gameCode, args.programId, args.heat);
        break;
      case 'getAthleteDetails':
        result = await SwimLiveScraper.getAthleteDetails(args.swimmerCode);
        break;
      case 'searchAthletes': {
        const params = {};
        if (args.name) params.name = args.name;
        if (args.id) params.id = args.id;
        if (args.member_group_code) params.member_group_code = args.member_group_code;
        if (args.entry_group_name) params.entry_group_name = args.entry_group_name;
        if (args.school_class_code) params.school_class_code = args.school_class_code;
        if (args.gender_code) params.gender_code = args.gender_code;
        
        // 最低限の検索条件チェック（名前かIDかコードか所属名のいずれか）
        if (!params.name && !params.id && !params.member_group_code && !params.entry_group_name) {
          return JSON.stringify({ error: '検索するには選手名(name)、選手ID(id)、所属コード(member_group_code)、または所属名(entry_group_name)のいずれかが必要です。' });
        }
        result = await SwimLiveScraper.searchAthletes(params);
        break;
      }
      case 'searchAthleteAcrossGames': {
        let searchName = args.name;
        // swimmerCode が指定されている場合は、まず選手詳細から名前を取得する
        if (args.swimmerCode && !searchName) {
          try {
            const details = await SwimLiveScraper.getAthleteDetails(args.swimmerCode);
            if (details && details.swimmer_name) {
              searchName = details.swimmer_name;
            } else {
              return JSON.stringify({ error: `選手ID ${args.swimmerCode} の情報が見つかりませんでした。` });
            }
          } catch (e) {
             // ID変換が必要なケースも考慮（main.jsと同様のワークアラウンド）
             try {
                const apiId = SwimLiveScraper.swimmerCodeToApiId(args.swimmerCode);
                const details = await SwimLiveScraper.getAthleteDetails(apiId);
                if (details && details.swimmer_name) {
                    searchName = details.swimmer_name;
                } else {
                    return JSON.stringify({ error: `選手ID ${args.swimmerCode} の情報が見つかりませんでした。` });
                }
             } catch (e2) {
                return JSON.stringify({ error: `選手ID ${args.swimmerCode} の取得に失敗しました: ${e2.message}` });
             }
          }
        }
        
        if (!searchName) {
          return JSON.stringify({ error: '検索するには選手名(name)または選手ID(swimmerCode)が必要です。' });
        }
        
        result = await SwimLiveScraper.searchAthleteAcrossGames(searchName);
        break;
      }
      case 'getAthleteBestRecord':
        result = await SwimLiveScraper.getAthleteBestRecord(
          args.swimmerCode, args.waterwayCode, args.styleCode, args.distanceCode
        );
        break;
      case 'getMemberGroupGames':
        result = await SwimLiveScraper.getMemberGroupGames(args.groupId);
        break;
      case 'getRaceHeatsListByGameDate':
        result = await SwimLiveScraper.getRaceHeatsListByGameDate(args.gameCode, args.date);
        break;
      case 'getAthleteBestFinaPoints':
        result = await SwimLiveScraper.getAthleteBestFinaPoints(args.swimmerCode, args.year, args.waterwayCode);
        break;
      case 'getAthleteSwimedRaces':
        result = await SwimLiveScraper.getAthleteSwimedRaces(args.swimmerCode, args.waterwayCode, args.styleCode);
        break;
      case 'getAthleteGraphs':
        result = await SwimLiveScraper.getAthleteGraphs(args.swimmerCode, args.waterwayCode, args.styleCode, args.distanceCode);
        break;
      case 'addAthlete': {
        const athleteId = args.athleteId;
        if (!/^\d+$/.test(athleteId)) {
          return JSON.stringify({ error: '選手IDは数字で指定してください。' });
        }
        try {
          let athleteData;
          try {
            athleteData = await SwimLiveScraper.getAthleteDetails(athleteId);
          } catch (e) {
            const apiId = SwimLiveScraper.swimmerCodeToApiId(athleteId);
            athleteData = await SwimLiveScraper.getAthleteDetails(apiId);
          }
          
          if (!athleteData || !athleteData.swimmer_name) {
            return JSON.stringify({ error: '指定された選手IDの選手が見つかりませんでした。' });
          }
          
          db.prepare('INSERT OR REPLACE INTO athletes (id, name, user_id) VALUES (?, ?, ?)').run(athleteId, athleteData.swimmer_name, contextId);
          console.log(`[AI Agent] Added athlete ${athleteId} (${athleteData.swimmer_name}) for user ${contextId}`);
          result = { success: true, message: `${athleteData.swimmer_name} (ID: ${athleteId}) を登録しました。` };
        } catch (err) {
          return JSON.stringify({ error: `登録中にエラーが発生しました: ${err.message}` });
        }
        break;
      }
      case 'deleteAthlete': {
        const targetId = args.athleteId;
        try {
          if (targetId === 'all') {
            db.prepare('DELETE FROM athletes WHERE user_id = ?').run(contextId);
            result = { message: '全ての選手を削除しました。' };
          } else {
            const info = db.prepare('DELETE FROM athletes WHERE id = ? AND user_id = ?').run(targetId, contextId);
            if (info.changes > 0) {
              result = { message: `選手 ID: ${targetId} を削除しました。` };
            } else {
              result = { message: `選手 ID: ${targetId} は登録されていません。` };
            }
          }
        } catch (err) {
          return JSON.stringify({ error: `削除中にエラーが発生しました: ${err.message}` });
        }
        break;
      }
      case 'listAthletes': {
        const athletes = db.prepare('SELECT id, name FROM athletes WHERE user_id = ?').all(contextId);
        if (athletes.length === 0) {
          result = { message: '登録されている選手はいません。' };
        } else {
          result = { athletes: athletes.map(a => `${a.name} (ID: ${a.id})`) };
        }
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    const resultStr = JSON.stringify(result);
    console.log(`[AI Agent] Tool ${name} returned ${resultStr.length} chars, preview: ${resultStr.substring(0, 200)}`);
    return resultStr;
  } catch (err) {
    console.error(`[AI Agent] Tool execution error (${name}):`, err);
    return JSON.stringify({ error: err.message || 'ツールの実行に失敗しました' });
  }
}

const SYSTEM_PROMPT = `あなたは水泳大会情報アシスタントです。
swim-live-scraperのツールを使って、ユーザーの質問に答えてください。

重要なルール:
- 回答はLINEメッセージとして送信されるため、**簡潔にまとめて**ください。
- 長文や過度な装飾は避け、要点のみを箇条書きや短い文章で伝えます。
- データが多い場合は上位5件程度に絞って提示してください。
- ツールから得たデータをそのまま出力せず、ユーザーにとって読みやすい形に整形してください。
- 日本語で回答してください。
- **ツールの実行結果を厳密に確認してください。** エラーが返された場合は、絶対に「成功しました」「完了しました」と言わず、エラー内容をそのままユーザーに伝えてください。
- addAthlete や deleteAthlete の結果が { message: "..." } であればその内容を、{ error: "..." } であればエラー内容を伝えてください。
- searchAthleteAcrossGames が空の結果を返した場合、選手名の表記ゆれ（姓のみ、名のみ、漢字/ひらがな等）を試して再検索してください。
- ツール結果が空でも、すぐに「見つかりませんでした」と答えず、別の検索方法を試してください。`;

/**
 * AIエージェントのメイン処理
 * @param {string} userId - LINE User ID
 * @param {string} apiKey - ユーザーのGemini API Key
 * @param {string} userMessage - ユーザーからのメッセージ
 * @returns {Promise<string>} - AIの応答テキスト
 */
async function processPrompt(userId, apiKey, userMessage) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
    tools: TOOLS
  });

  // キャッシュから会話履歴を取得、または新規作成
  let history = chatCache.get(userId) || [];

  const chat = model.startChat({ history });

  // ユーザーメッセージを送信
  let result = await chat.sendMessage(userMessage);
  let response = result.response;

  // Function Calling ループ: モデルが関数呼び出しを要求する限り継続
  while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall)) {
    const parts = response.candidates[0].content.parts;
    const functionResponses = [];

    for (const part of parts) {
      if (part.functionCall) {
        const toolResult = await executeToolCall(part.functionCall, userId);
        functionResponses.push({
          functionResponse: {
            name: part.functionCall.name,
            response: { result: toolResult }
          }
        });
      }
    }

    // ツール結果をモデルに返して次の応答を得る
    // functionResponses は [{ functionResponse: { name, response } }] の形式
    result = await chat.sendMessage(functionResponses);
    response = result.response;
  }

  // 最終的なテキスト応答を取得
  const text = response.text();

  // 会話履歴を更新してキャッシュに保存
  const updatedHistory = chat.history;
  chatCache.set(userId, updatedHistory);

  return text || '応答を生成できませんでした。';
}

module.exports = { processPrompt };
