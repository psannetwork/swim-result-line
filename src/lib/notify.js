const { messagingApi } = require('@line/bot-sdk');

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

async function sendLineNotification(userId, message, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.pushMessage({
        to: userId,
        messages: [message]
      });
      return; // Success
    } catch (err) {
      console.error(`[Notify] Attempt ${i + 1} failed sending LINE message to ${userId}:`, err.message);
      
      // If it's a 400 error, don't retry (it's likely a permanent error, like invalid JSON)
      if (err.status === 400) {
        throw err;
      }

      if (i === retries - 1) {
        throw err; // Final attempt failed
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = { sendLineNotification };
