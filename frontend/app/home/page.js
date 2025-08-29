"use client";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import socket from "../apis/socket.js";

export default function HomePage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user) {
      socket.connect();
      fetchConversations();

      socket.on("receive_message", (messageData) => {
        if (messageData.conversationId === currentConversation?.id) {
          setMessages((prev) => [...prev, messageData]);
        }
      });

      socket.on("user_typing", (data) => {
        if (data.userId !== user.id) {
          setTypingUsers((prev) => [
            ...prev.filter((u) => u.userId !== data.userId),
            data,
          ]);
        }
      });

      socket.on("user_stop_typing", (data) => {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
      });

      socket.on("message_read", (data) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, read: true } : msg
          )
        );
      });

      return () => {
        socket.off("receive_message");
        socket.off("user_typing");
        socket.off("user_stop_typing");
        socket.off("message_read");
        socket.disconnect();
      };
    }
  }, [isAuthenticated, user, currentConversation]);

  const fetchConversations = async () => {
    try {
      setConversationsLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:8080/api/v1/conversation",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConversations(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:8080/api/v1/conversation/${conversationId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const createTestConversation = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:8080/api/v1/conversation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "private",
            memberIds: [],
          }),
        }
      );

      if (response.ok) {
        await fetchConversations();
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const joinConversation = (conversation) => {
    if (currentConversation) {
      socket.emit("leave_conversation", {
        conversationId: currentConversation.id,
      });
    }

    setCurrentConversation(conversation);
    setMessages([]);

    socket.emit("join_conversation", {
      userId: user.id,
      conversationId: conversation.id,
    });

    fetchMessages(conversation.id);
  };

  const sendMessage = () => {
    if (message.trim() && currentConversation) {
      const messageData = {
        conversationId: currentConversation.id,
        senderId: user.id,
        content: message.trim(),
        messageType: "text",
      };

      socket.emit("send_message", messageData);
      setMessage("");
      setIsTyping(false);
      socket.emit("typing_stop", {
        conversationId: currentConversation.id,
        userId: user.id,
      });
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing_start", {
        conversationId: currentConversation?.id,
        userId: user.id,
        userName: user.name,
      });
    }

    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing_stop", {
        conversationId: currentConversation?.id,
        userId: user.id,
      });
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-orange-600">FaffSap</h1>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-white font-medium">
                  {user?.name || user?.email}
                </div>
              </div>
              <button
                onClick={logout}
                className="bg-transparent border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        <div className="w-80 bg-gray-900/50 border-r border-gray-800 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-semibold">Conversations</h2>
            <button
              onClick={() => createTestConversation()}
              className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition-colors"
            >
              New
            </button>
          </div>
          <div className="space-y-2">
            {conversationsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">
                  Loading conversations...
                </p>
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => joinConversation(conv)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversation?.id === conv.id
                      ? "bg-orange-600/20 border border-orange-600"
                      : "bg-gray-800/50 hover:bg-gray-700/50"
                  }`}
                >
                  <div className="text-white font-medium">
                    {conv.name || "Private Chat"}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {conv.type === "private" ? "Private" : "Group"}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No conversations yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {currentConversation ? (
            <>
              <div className="bg-gray-900/50 border-b border-gray-800 p-4">
                <h3 className="text-white font-semibold">
                  {currentConversation.name || "Private Chat"}
                </h3>
                {typingUsers.length > 0 && (
                  <div className="text-gray-400 text-sm">
                    {typingUsers.map((u) => u.userName).join(", ")} typing...
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.senderId === user.id ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] ${
                        msg.senderId === user.id ? "ml-auto" : "mr-auto"
                      }`}
                    >
                      <div className="px-3 py-2 rounded-lg border border-gray-700 text-sm leading-relaxed break-words text-white">
                        {msg.content}
                      </div>
                      <div
                        className={`text-xs mt-1 text-gray-400 ${
                          msg.senderId === user.id ? "text-right" : "text-left"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString()} ·{" "}
                        {msg.senderName}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-800 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    placeholder="Type a message..."
                    onChange={handleTyping}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:outline-none focus:border-orange-600"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="bg-orange-600 text-white px-6 py-2 rounded font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <h3 className="text-xl font-semibold mb-2">
                  Welcome to FaffSap
                </h3>
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
