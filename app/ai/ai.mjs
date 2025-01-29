const { ChatOpenAI } = await import("@langchain/openai");

export function getModel(options = {}) {
  return new ChatOpenAI({
    temperature: options.temperature || Number(process.env.AI_CHAT_MODEL_TEMPERATURE) || 0.9,
    openAIApiKey: options.openAIApiKey || process.env.OPENAI_API_KEY || 'EMPTY',
    modelName: options.modelName || process.env.AI_CHAT_MODEL_NAME || 'mistral'
  }, {
    baseURL: options.baseURL || process.env.AI_CHAT_BASE_URL || 'http://localhost:8000/v1'
  });
}
