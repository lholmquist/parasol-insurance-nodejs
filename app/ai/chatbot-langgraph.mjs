import path from 'node:path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import {
  Annotation,
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

import { setupTools } from './tools.mjs';

let app;

export async function createChain(model, fastify) {
  //////////////////////////////////////////////////
  // Load the doc and store into the memory store //
  // Parse and load the pdf
  const loader = new PDFLoader(path.join(__dirname, '../', 'resources', 'policies', 'policy-info.pdf'));
  const docs = await loader.load();

  // Split the docs up
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 20
  });
  const splits = await textSplitter.splitDocuments(docs);

  // Instantiate Embeddings function
  const embeddings = new HuggingFaceTransformersEmbeddings();

  const vectorStore = await MemoryVectorStore.fromDocuments(
    splits,
    embeddings
  );

  // Setup the tool
  const updateClaimStatusTool = setupTools(fastify);

  ////////////////////////////////
  // CREATE CHAIN
  const promptTemplate = ChatPromptTemplate.fromMessages([
    [ 'system',
      'You are a helpful, respectful and honest assistant named "Parasol Assistant".' +
      'You will be given a claim summary, references to provide you with information, and a question. You must answer the question based as much as possible on this claim with the help of the references.' +
      'Always answer as helpfully as possible, while being safe. Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.' +
      'If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don\'t know the answer to a question, please don\'t share false information.' + 
      'You must answer in 4 sentences or less.' +
      'Don\'t make up policy term limits by yourself' +
      'Context: {context}'
    ],
    new MessagesPlaceholder('messages')
  ]);

  const StateAnnotation = Annotation.Root({
    question: Annotation,
    context: Annotation,
    answer: Annotation,
    ...MessagesAnnotation.spec
  });

  //Define the application steps
  const retrieve = async function(state) {
    console.log('Rag Retriever');
    // retrieve the relevant docs from the memory store
    const retrievedDocs = await vectorStore.similaritySearch(state.question.query);
    return {
      context: retrievedDocs
    };
  }

  const generate = async function(state) {
    console.log('Rag Generate and ask');
    const docsContent = state.context.map(docs => docs.pageContent).join('\n');
    state.messages.push({role: 'user', content: createQuestion(state.question)});
    // Need to add the tool to the model
    const llmWithTools = model.bindTools([updateClaimStatusTool]);
    const runnableChain = promptTemplate.pipe(llmWithTools);
    const response = await runnableChain.invoke({ messages: state.messages, context: docsContent });
    console.log('response', response);
    return { messages: [response] };
  }

  const tools = new ToolNode([updateClaimStatusTool]);

  const queryOrRespond = async function(state) {
    let recentToolMessages = [];
    for (let i = state["messages"].length - 1; i >= 0; i--) {
      let message = state["messages"][i];
      if (message instanceof ToolMessage) {
        recentToolMessages.push(message);
      } else {
        break;
      }
    }
    let toolMessages = recentToolMessages.reverse();
    console.log('toolmessages', toolMessages);
    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        ((message instanceof AIMessage || message instanceof AIMessageChunk) && message.tool_calls.length == 0)
    );

    console.log('conversationMessages', conversationMessages);
    return { messages: [conversationMessages] };
  }

  //Compile the applcation and test
  const workflow = new StateGraph(StateAnnotation)
    .addNode('retrieve', retrieve)
    .addNode('tools', tools)
    .addNode('queryOrRespond', queryOrRespond)
    .addNode('generate', generate)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'generate')
    .addConditionalEdges('generate', toolsCondition, {
      __end__: '__end__',
      tools: 'tools'
    })
    .addEdge('tools', 'queryOrRespond')
    .addEdge('queryOrRespond', END)

  const memory = new MemorySaver();

  app = workflow.compile({checkpointer: memory});
}

export async function chat(question, sessionId) {
  const input = {
    question: question
  };

  const config = {
    streamMode: 'messages',
    configurable: {
      thread_id: sessionId
    }
  };

  const result = await app.stream(input, config);
  console.log('returning the result', result);
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
