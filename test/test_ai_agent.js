const { processPrompt } = require('../src/lib/ai/agent');

/**
 * AIエージェントのテスト
 * 使用法: GEMINI_API_KEY=your_key node test/test_ai_agent.js
 */
async function testAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('Skipping AI test: GEMINI_API_KEY not set');
    console.log('Run with: GEMINI_API_KEY=your_key node test/test_ai_agent.js');
    return;
  }

  console.log('Testing AI Agent...');
  try {
    const userId = 'test-user-001';
    const prompt = '大会一覧を取得して';
    console.log('Prompt:', prompt);
    const result = await processPrompt(userId, apiKey, prompt);
    console.log('Result:', result);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testAI();
