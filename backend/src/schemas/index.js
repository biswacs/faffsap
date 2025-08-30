import sequelize from "../config/database.js";
import User from "./user.schema.js";
import Conversation from "./conversation.schema.js";
import Message from "./message.schema.js";
import ConversationMember from "./conversationMember.schema.js";
import ReadReceipt from "./readReceipt.schema.js";
import MessageEmbedding from "./messageEmbedding.schema.js";

User.hasMany(Message, { foreignKey: "senderId", as: "messages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });

Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages" });
Message.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});

User.belongsToMany(Conversation, {
  through: ConversationMember,
  as: "conversations",
  foreignKey: "userId",
  otherKey: "conversationId",
});
Conversation.belongsToMany(User, {
  through: ConversationMember,
  as: "members",
  foreignKey: "conversationId",
  otherKey: "userId",
});

Message.hasMany(ReadReceipt, { foreignKey: "messageId", as: "readReceipts" });
ReadReceipt.belongsTo(Message, { foreignKey: "messageId", as: "message" });

User.hasMany(ReadReceipt, { foreignKey: "userId", as: "readReceipts" });
ReadReceipt.belongsTo(User, { foreignKey: "userId", as: "user" });

// Message embedding associations
Message.hasOne(MessageEmbedding, { foreignKey: "messageId", as: "embedding" });
MessageEmbedding.belongsTo(Message, { foreignKey: "messageId", as: "message" });

export {
  sequelize,
  User,
  Conversation,
  Message,
  ConversationMember,
  ReadReceipt,
  MessageEmbedding,
};
