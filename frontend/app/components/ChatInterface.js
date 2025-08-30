import { useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import SearchInterface from "./SearchInterface";

export default function ChatInterface({
  conversation,
  messages,
  message,
  setMessage,
  typingUsers,
  currentUserId,
  messagesEndRef,
  onBack,
  onSendMessage,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleSearch = () => {
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <ChatHeader
        conversation={conversation}
        typingUsers={typingUsers}
        onBack={onBack}
        onSearch={handleSearch}
      />

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        messagesEndRef={messagesEndRef}
      />

      <MessageInput
        message={message}
        setMessage={setMessage}
        onSendMessage={onSendMessage}
        disabled={!message.trim()}
      />

      <SearchInterface
        isOpen={isSearchOpen}
        onClose={handleCloseSearch}
        conversationId={conversation?.id}
        currentUserId={currentUserId}
      />
    </div>
  );
}
