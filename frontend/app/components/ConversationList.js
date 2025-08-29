import { MessageCircle, User } from "lucide-react";

export default function ConversationList({
  conversations,
  onConversationSelect,
}) {
  const getUnreadCount = (conversation) => {
    return conversation.unreadCount || 0;
  };

  const hasUnreadMessages = (conversation) => {
    return getUnreadCount(conversation) > 0;
  };

  const formatUnreadCount = (count) => {
    if (count > 99) return "99+";
    return count.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Your Conversations
      </h3>
      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No conversations yet</p>
          <p className="text-sm text-gray-400">
            Search for users above to start chatting!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onConversationSelect(conversation)}
              className="w-full text-left p-4 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors relative"
            >
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  {hasUnreadMessages(conversation) && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-xs text-white font-medium">
                        {formatUnreadCount(getUnreadCount(conversation))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-base font-medium ${
                        hasUnreadMessages(conversation)
                          ? "text-gray-900 font-semibold"
                          : "text-gray-900"
                      }`}
                    >
                      {conversation.otherUser?.username || "Unknown User"}
                    </p>
                    {conversation.lastMessageAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(
                          conversation.lastMessageAt
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {conversation.lastMessage ? (
                    <div className="flex items-center justify-between mt-1">
                      <p
                        className={`text-sm truncate ${
                          hasUnreadMessages(conversation)
                            ? "text-gray-900 font-medium"
                            : "text-gray-600"
                        }`}
                      >
                        {conversation.lastMessage.content}
                      </p>
                      <div className="flex items-center space-x-2 ml-2">
                        {conversation.lastMessage.senderId !==
                          conversation.otherUser?.id && (
                          <div className="flex items-center space-x-1">
                            {conversation.lastMessage.readReceipts &&
                            conversation.lastMessage.readReceipts.length > 0 ? (
                              <span className="text-xs text-green-600">✓✓</span>
                            ) : (
                              <span className="text-xs text-gray-400">✓</span>
                            )}
                          </div>
                        )}
                        {hasUnreadMessages(conversation) && (
                          <span className="text-xs text-red-500 font-medium">
                            {formatUnreadCount(getUnreadCount(conversation))}{" "}
                            new
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic mt-1">
                      No messages yet
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
