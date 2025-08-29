import { useRef, useEffect } from "react";
import { Check, CheckCheck } from "lucide-react";

export default function MessageList({
  messages,
  currentUserId,
  messagesEndRef,
}) {
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getReadReceiptIcon = (message) => {
    if (message.senderId !== currentUserId) return null;

    if (message.readReceipts && message.readReceipts.length > 0) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    }
    return <Check className="w-4 h-4 text-gray-400" />;
  };

  const getReadReceiptText = (message) => {
    if (message.senderId !== currentUserId) return null;

    if (message.readReceipts && message.readReceipts.length > 0) {
      const readAt = new Date(message.readReceipts[0].readAt);
      return `Read at ${readAt.toLocaleTimeString()}`;
    }
    return "Delivered";
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.map((msg, index) => (
        <div
          key={msg.isTemp ? `temp-${msg.id}` : `msg-${msg.id}`}
          className={`flex ${
            msg.senderId === currentUserId ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              msg.senderId === currentUserId
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200"
            } ${msg.isTemp ? "opacity-70" : ""}`}
          >
            <p className="text-sm">{msg.content}</p>
            <div className="flex items-center justify-between mt-1">
              <p
                className={`text-xs ${
                  msg.senderId === currentUserId
                    ? "opacity-75"
                    : "text-gray-500"
                }`}
              >
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
              {msg.senderId === currentUserId && (
                <div className="flex items-center space-x-1 ml-2">
                  {getReadReceiptIcon(msg)}
                  <span className="text-xs opacity-75">
                    {getReadReceiptText(msg)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
