import { getModel } from '../ai/ai.mjs';
import {  createChain, answerQuestion } from '../ai/chatbot-with-tools.mjs';

async function chatbotWSRoute (fastify, options) {
  fastify.get('/ws/query', { websocket: true }, (ws, req) => {
    const controller = new AbortController();

    ws.on('close', () => {
     //  resetSessions(ws);
     //  controller.abort();
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
        const answerStream = await answerQuestion(JSONmessage, ws);

        const formattedAnswer = {
          type: 'token',
          token: answerStream.content,
          source: ''
        };
        ws.send(JSON.stringify(formattedAnswer));

        // for await (const chunk of answerStream) {
        //   console.log(`Got Chat Response: ${chunk.answer}`);

        //   //'{"type":"token","token":" Hello","source":""}'
        //   const formattedAnswer = {
        //     type: 'token',
        //     token: chunk.answer,
        //     source: ''
        //   };

        //   ws.send(JSON.stringify(formattedAnswer));
        // }
      } catch (err) {
        console.log(err);
      }

      console.log('Done Asking', new Date());
    });

    // AI Related Setup
    // TODO: Bind tools
    const model = getModel(); //.bind({ signal: controller.signal });
    createChain(model, fastify);
  });
}

export default chatbotWSRoute;
