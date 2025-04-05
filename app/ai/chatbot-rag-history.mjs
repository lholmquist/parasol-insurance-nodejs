import createRagRetrieverChain from './rag.mjs';
import { setupTools } from './tools/claimtool.mjs';

import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';

let sessions = {};
let chainWithHistory;
let toolByName;

export async function createChain(model, fastify) {
  //////////////////////////////
  // CREATE CHAIN

  const prompt = ChatPromptTemplate.fromMessages([
    [ 'system',
      'You are a helpful, respectful and honest assistant named "Parasol Assistant".' +
      'You will be given a claim summary, references to provide you with information, and a question. You must answer the question based as much as possible on this claim with the help of the references.' +
      'Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.' +
      'If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\'t know the answer to a question, please don\'t share false information.' + 
      'You must answer in 4 sentences or less.' +
      'Don\'t make up policy term limits by yourself'//  +
      // 'Context: {context}'
    ],
    new MessagesPlaceholder('history'),
    [ 'human', '{input}' ]
  ]);

  // Setup the tool
  const updateClaimStatusTool = setupTools(fastify);

  toolByName = {
    updateClaimStatus: updateClaimStatusTool
  };

  // Add Tools to model
  const modelWithTool = model.bindTools([updateClaimStatusTool], {tool_choice: 'auto'});

  // const chain = await createRagRetrieverChain(model, prompt);
  const chain = prompt.pipe(modelWithTool);

  chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: (sessionId) => {
      if (sessions[sessionId] === undefined) {
        sessions[sessionId] = new ChatMessageHistory();
      }
      return sessions[sessionId];
    },
    inputMessagesKey: 'input',
    outputMessagesKey: 'answer',
    historyMessagesKey: 'history',
  });
}

export async function chat(question, sessionId) {
  const result = await chainWithHistory.stream(
    { input: createQuestion(question) },
    { configurable: { sessionId: sessionId } }
  );

  return result;
}

export async function toolChat(question, sessionId) {
  let result = await chainWithHistory.invoke(
    { input: createQuestion(question) },
    { configurable: { sessionId: sessionId } }
  );

  for (const toolCall of result.tool_calls) {
    const selectedTool = toolByName[toolCall.name];
    result = await selectedTool.invoke(toolCall);
  }

  return result;
}

export function resetSessions(sessionId) {
  delete sessions[sessionId];
}

function createQuestion(rawQuestion) {
  return `Claim ID: ${rawQuestion.claimId}

  Claim Inception Date: ${rawQuestion.inceptionDate}

  Claim Summary:

  ${rawQuestion.claim}

  Question: ${rawQuestion.query}
  `
}
