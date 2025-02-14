import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver
} from '@langchain/langgraph';

let app;

export function createChain(model) {
  ////////////////////////////////
  // CREATE CHAIN
  const promptTemplate = ChatPromptTemplate.fromMessages([
    [ 'system',
      'You are a helpful, respectful and honest assistant named "Parasol Assistant".' +
      'You will be given a claim summary, references to provide you with information, and a question. You must answer the question based as much as possible on this claim with the help of the references.' +
      'Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.' +
      'If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\'t know the answer to a question, please don\'t share false information.' + 
      'Don\'t make up policy term limits by yourself'
    ],
    new MessagesPlaceholder('messages')
  ]);

  const runnableChain = promptTemplate.pipe(model);

  const callModel = async function(state) {
    const response = await runnableChain.invoke(state);
    return { messages: [response] };
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('model', callModel)
    .addEdge(START, 'model')
    .addEdge('model', END);

  const memory = new MemorySaver();

  app = workflow.compile({checkpointer: memory});
}

export async function chat(question, sessionId) {
  const input = {
    messages: [{
      role: 'user',
      content: createQuestion(question)
    }]
  }

  const config = {
    streamMode: 'messages',
    configurable: {
      thread_id: sessionId
    }
  };

  const result = await app.stream(input, config);
  return result;
}

export async function resetSessions(sessionId) {
  console.log('TODO');
}

function createQuestion(rawQuestion) {
  return `Claim ID: ${rawQuestion.claimId}

  Policy Inception Date: ${rawQuestion.inceptionDate}

  Claim Summary:

  ${rawQuestion.claim}

  Question: ${rawQuestion.query}
  `
}
