import Queue from "bull";
import dotenv from "dotenv";

dotenv.config();

export const messageEmbeddingQueue = new Queue("message-embedding", {
  redis:
    "redis://default:y0p8eGV0Sj55PGvNvs8rHFzXih5aedOm@redis-17822.c241.us-east-1-4.ec2.redns.redis-cloud.com:17822",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

messageEmbeddingQueue.process(async (job) => {
  const { messageId, content, messageType } = job.data;

  try {
    const { OpenAI } = await import("openai");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (messageType !== "text") {
      return { messageId, skipped: true, reason: "Non-text message" };
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
      encoding_format: "float",
    });

    const embedding = embeddingResponse.data[0].embedding;

    const { typesenseClient, messageEmbeddingSchema } = await import(
      "./typesense.js"
    );

    const { Message } = await import("../schemas/index.js");
    const message = await Message.findByPk(messageId);

    if (message) {
      const document = {
        id: messageId,
        messageId,
        content,
        senderId: message.senderId,
        conversationId: message.conversationId,
        messageType: message.messageType,
        createdAt: Math.floor(message.createdAt.getTime() / 1000),
        embedding,
      };

      await typesenseClient
        .collections(messageEmbeddingSchema.name)
        .documents()
        .create(document);
    }

    return { messageId, success: true, embeddingLength: embedding.length };
  } catch (error) {
    console.error(
      `Error processing embedding for message ${messageId}:`,
      error
    );
    throw error;
  }
});

messageEmbeddingQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

messageEmbeddingQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

export default messageEmbeddingQueue;
