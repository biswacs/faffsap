import dotenv from "dotenv";
import { messageEmbeddingQueue } from "./src/config/queue.js";

dotenv.config();

console.log("Starting message embedding queue worker...");


process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await messageEmbeddingQueue.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await messageEmbeddingQueue.close();
  process.exit(0);
});

// Log queue events
messageEmbeddingQueue.on("waiting", (jobId) => {
  console.log(`Job ${jobId} is waiting`);
});

messageEmbeddingQueue.on("active", (job) => {
  console.log(`Processing job ${job.id} for message ${job.data.messageId}`);
});

messageEmbeddingQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

messageEmbeddingQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log("Worker is running. Press Ctrl+C to stop.");
