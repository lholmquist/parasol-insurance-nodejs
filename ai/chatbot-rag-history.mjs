import createRagRetrieverChain from './rag.mjs';
import { setupTools } from "./tools.mjs";

import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

let sessions = {};
let chainWithHistory;
let toolsByName;
let model;
let messages;

export async function createChain(_model, fastify) {
  //////////////////////////////
  // CREATE CHAIN

  messages = [new SystemMessage('You are a helpful, respectful and honest assistant named "Parasol Assistant".' +
      'You will be given a claim summary, references to provide you with information, and a question. You must answer the question based as much as possible on this claim with the help of the references.' +
      'Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.' +
      'If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\'t know the answer to a question, please don\'t share false information.' + 
      'You must answer in 4 sentences or less.' +
      'Don\'t make up policy term limits by yourself')];

  // const prompt = ChatPromptTemplate.fromMessages([
  //   [ 'system',
  //     'You are a helpful, respectful and honest assistant named "Parasol Assistant".' +
  //     'You will be given a claim summary, references to provide you with information, and a question. You must answer the question based as much as possible on this claim with the help of the references.' +
  //     'Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.' +
  //     'If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\'t know the answer to a question, please don\'t share false information.' + 
  //     'You must answer in 4 sentences or less.' +
  //     'Don\'t make up policy term limits by yourself'
  //   ],
  //   new MessagesPlaceholder('history'),
  //   [ 'human', '{input}' ]
  // ]);

  //Add the tools to the model
  const updateClaimStatusTool = setupTools(fastify);
  model = _model.bindTools([updateClaimStatusTool])

  toolsByName = {
    updateClaimStatus: updateClaimStatusTool
  };

  // const chain = await createRagRetrieverChain(model, prompt);
  // const chain = prompt.pipe(model);

  // chainWithHistory = new RunnableWithMessageHistory({
  //   runnable: chain,
  //   getMessageHistory: (sessionId) => {
  //     if (sessions[sessionId] === undefined) {
  //       sessions[sessionId] = new ChatMessageHistory();
  //     }
  //     return sessions[sessionId];
  //   },
  //   inputMessagesKey: 'input',
  //   historyMessagesKey: 'history',
  // });

}

export async function chat(question, sessionId) {
  messages.push(new HumanMessage(createQuestion(question)));

  const result = await model.invoke(messages);
  messages.push(result);

  if (result.tool_calls.length < 1) {
    return result;
  }


  console.log(sessions[sessionId]);
  console.log(result);
  console.log('Tool Call Prop?', result.tool_calls);

  for(const toolCall of result.tool_calls) {
    console.log('llm is called a tool');
    console.log(toolCall.name);
    const selectedTool = toolsByName[toolCall.name];
    const toolMessage = await selectedTool.invoke(toolCall);
    messages.push(toolMessage);
  }

  const result2 = await model.invoke(messages);

  console.log(result2);

  return result2;
}

export function resetSessions(sessionId) {
  delete sessions[sessionId];
}

function createQuestion(rawQuestion) {
  return `Claim ID: ${rawQuestion.claimId}

  Policy Inception Date: ${rawQuestion.inceptionDate}

  Claim Summary:

  ${rawQuestion.claim}

  Question: ${rawQuestion.query}
  `
}
