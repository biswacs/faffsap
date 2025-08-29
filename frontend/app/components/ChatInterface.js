import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

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
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <ChatHeader
        conversation={conversation}
        typingUsers={typingUsers}
        onBack={onBack}
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
    </div>
  );
}
