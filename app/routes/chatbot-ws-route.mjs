import * as traceloop from '@traceloop/node-server-sdk';
import { trace, context } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

import * as ChainsModule from 'langchain/chains';
import * as ToolsModule from 'langchain/tools';
import * as RunnablesModule from '@langchain/core/runnables';

traceloop.initialize({
  disableBatch: true,
  exporter: new OTLPTraceExporter(),
  instrumentModules: {
    langchain: {
      chainsModule: ChainsModule,
      // agentsModule: AgentsModule,
      toolsModule: ToolsModule,
      // vectorStoreModule: VectorStoreModule,
      runnablesModule: RunnablesModule
    }
  }
});

import { getModel } from '../ai/ai.mjs';
import {  createChain, chat, resetSessions, toolChat } from '../ai/chatbot-rag-history.mjs';

async function chatbotWSRoute (fastify, options) {
  fastify.get('/ws/query', { websocket: true }, (ws, req) => {
    const controller = new AbortController();

    ws.on('close', () => {
      resetSessions(ws);
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
        // const answerStream = await chat(JSONmessage, ws);

        // for await (const chunk of answerStream) {
        //   console.log(`Got Chat Response: ${chunk.content || chunk.answer}`);

        //   //'{"type":"token","token":" Hello","source":""}'
        //   const formattedAnswer = {
        //     type: 'token',
        //     token: chunk.content || chunk.answer,
        //     source: ''
        //   };

        //   ws.send(JSON.stringify(formattedAnswer));
        // }

        const tracer = trace.getTracer();
        tracer.startActiveSpan('Asking the question', async (span) => {
          const toolAnswer = await toolChat(JSONmessage, ws);
          span.end();

          const formattedAnswer = {
            type: 'token',
            token: toolAnswer.content || toolAnswer.answer,
            source: ''
          };
          ws.send(JSON.stringify(formattedAnswer));
        });
      } catch (err) {
        console.log(err);
      }

      console.log('Done Asking', new Date());
    });

    // AI Related Setup
    //const model = getModel().bind({ signal: controller.signal });
    const model = getModel();

    createChain(model, fastify);
  });
}

export default chatbotWSRoute;
