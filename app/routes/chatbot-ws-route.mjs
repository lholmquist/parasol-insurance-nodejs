import { getModel } from '../ai/ai.mjs';
import {  createChain, chat, resetSessions } from '../ai/chatbot-langgraph.mjs';
import { v4 as uuidv4 } from 'uuid';

async function chatbotWSRoute (fastify, options) {
  fastify.get('/ws/query', { websocket: true }, (ws, req) => {
    const controller = new AbortController();
    const sessionId = uuidv4();
    ws.on('close', () => {
      resetSessions(sessionId);
      controller.abort();
      console.log('connection closed');
    });

    ws.on('error', console.error);

    ws.on('message', async (data) => {
      const stringData = data.toString();

      // This should be JSON
      let JSONmessage;
      try {
        JSONmessage = JSON.parse(stringData);
      } catch(err) {
        console.log(err);
      }

      console.log('Query from the Client', JSONmessage);

      console.log('Starting to Ask', new Date());

      try {
        const answerStream = await chat(JSONmessage, sessionId);

        for await (const [chunk, _metadata] of answerStream) {
          console.log(`Got Chat Response: ${chunk.content || chunk.answer}`);

          //'{"type":"token","token":" Hello","source":""}'
          const formattedAnswer = {
            type: 'token',
            token: chunk.content || chunk.answer,
            source: ''
          };

          ws.send(JSON.stringify(formattedAnswer));
        }
      } catch (err) {
        console.log(err);
      }

      console.log('Done Asking', new Date());
    });

    // AI Related Setup
    const model = getModel();
    createChain(model, fastify);
  });
}

export default chatbotWSRoute;
