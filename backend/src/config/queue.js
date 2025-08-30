import Queue from "bull";
import dotenv from "dotenv";

dotenv.config();

// Create a queue for processing message embeddings
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

// Process jobs in the queue
messageEmbeddingQueue.process(async (job) => {
  const { messageId, content, messageType } = job.data;

  try {
    // Import OpenAI and create embedding
    const { OpenAI } = await import("openai");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Skip non-text messages
    if (messageType !== "text") {
      return { messageId, skipped: true, reason: "Non-text message" };
    }

    // Create embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content,
      encoding_format: "float",
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Import Typesense client and save embedding
    const { typesenseClient, messageEmbeddingSchema } = await import(
      "./typesense.js"
    );

    // Get message details for Typesense
    const { Message } = await import("../schemas/index.js");
    const message = await Message.findByPk(messageId);

    if (message) {
      // Create document for Typesense
      const document = {
        id: messageId,
        messageId,
        content,
        senderId: message.senderId,
        conversationId: message.conversationId,
        messageType: message.messageType,
        createdAt: Math.floor(message.createdAt.getTime() / 1000), // Convert to Unix timestamp
        embedding,
      };

      // Add to Typesense collection
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

// Handle failed jobs
messageEmbeddingQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

// Handle completed jobs
messageEmbeddingQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

export default messageEmbeddingQueue;
