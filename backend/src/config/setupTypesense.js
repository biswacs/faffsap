import { typesenseClient, messageEmbeddingSchema } from "./typesense.js";

export const setupTypesense = async () => {
  try {
    try {
      await typesenseClient.collections(messageEmbeddingSchema.name).retrieve();
      console.log(`Collection ${messageEmbeddingSchema.name} already exists`);
    } catch (error) {
      await typesenseClient.collections().create(messageEmbeddingSchema);
      console.log(
        `Collection ${messageEmbeddingSchema.name} created successfully`
      );
    }
  } catch (error) {
    console.error("Error setting up Typesense:", error);
    throw error;
  }
};

export default setupTypesense;
