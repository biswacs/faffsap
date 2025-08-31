import Typesense from "typesense";

const typesenseConfig = {
  apiKey: "7CPcj7EbU6Fg1N2cOHqAALIRTv2t7KTC",
  nodes: [
    {
      host: "mzanbxh15t87egvip-1.a1.typesense.net",
      port: 443,
      protocol: "https",
    },
  ],
  connectionTimeoutSeconds: 2,
};

export const typesenseClient = new Typesense.Client(typesenseConfig);

export const messageEmbeddingSchema = {
  name: "message_embeddings",
  fields: [
    { name: "id", type: "string" },
    { name: "messageId", type: "string" },
    { name: "content", type: "string" },
    { name: "senderId", type: "string" },
    { name: "conversationId", type: "string" },
    { name: "messageType", type: "string" },
    { name: "createdAt", type: "int64" },
    { name: "embedding", type: "float[]", num_dim: 1536 },
  ],
  default_sorting_field: "createdAt",
};

export const performVectorSearch = async (
  collectionName,
  queryEmbedding,
  filters = {},
  limit = 20
) => {
  const searchRequest = {
    collection: collectionName,
    q: "*",
    vector_query: `embedding:([${queryEmbedding.join(",")}], k: ${limit})`,
    filter_by: Object.entries(filters)
      .map(([key, value]) => `${key}:=${value}`)
      .join(" && "),
    sort_by: "_vector_distance:asc",
    per_page: limit,
  };

  const multiSearchParams = {
    searches: [searchRequest],
  };

  const searchResults = await typesenseClient.multiSearch.perform(
    multiSearchParams
  );
  return searchResults.results[0];
};

export const performHybridSearch = async (
  collectionName,
  queryText,
  queryEmbedding,
  filters = {},
  limit = 20
) => {
  const searchRequest = {
    collection: collectionName,
    q: queryText,
    query_by: "content",
    vector_query: `embedding:([${queryEmbedding.join(",")}], k: ${limit})`,
    filter_by: Object.entries(filters)
      .map(([key, value]) => `${key}:=${value}`)
      .join(" && "),
    sort_by: "_text_match:desc,_vector_distance:asc",
    per_page: limit,
    text_query_weight: 0.7,
    vector_query_weight: 0.3,
    highlight_full_fields: "content",
    snippet_threshold: 0,
  };

  const multiSearchParams = {
    searches: [searchRequest],
  };

  const searchResults = await typesenseClient.multiSearch.perform(
    multiSearchParams
  );
  return searchResults.results[0];
};

export const performTextSearch = async (
  collectionName,
  queryText,
  filters = {},
  limit = 20
) => {
  const searchRequest = {
    collection: collectionName,
    q: queryText,
    query_by: "content",
    filter_by: Object.entries(filters)
      .map(([key, value]) => `${key}:=${value}`)
      .join(" && "),
    sort_by: "_text_match:desc,createdAt:desc",
    per_page: limit,
    highlight_full_fields: "content",
    snippet_threshold: 0,
  };

  const multiSearchParams = {
    searches: [searchRequest],
  };

  const searchResults = await typesenseClient.multiSearch.perform(
    multiSearchParams
  );
  return searchResults.results[0];
};

export default typesenseClient;
