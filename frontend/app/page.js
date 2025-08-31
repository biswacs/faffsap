"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  LogOut,
  User,
  Search,
  Send,
  Check,
  CheckCheck,
  X,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { io } from "socket.io-client";
import { BACKEND_URL } from "../config";

export default function RootPage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isConversationSearchOpen, setIsConversationSearchOpen] =
    useState(false);
  const [searchQuery2, setSearchQuery2] = useState("");
  const [searchResults2, setSearchResults2] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [allUsers, setAllUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedConversationRef = useRef(selectedConversation);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    console.log("Component mounted - BACKEND_URL:", BACKEND_URL);
    console.log("Component mounted - BACKEND_URL type:", typeof BACKEND_URL);

    const token = localStorage.getItem("auth_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }

    fetchUserProfile();
    fetchConversations();
  }, []);

  const fetchUserProfile = async () => {
    try {
      console.log("fetchUserProfile - BACKEND_URL:", BACKEND_URL);
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${BACKEND_URL}/api/v1/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${BACKEND_URL}/api/v1/conversation`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      console.log("Fetching messages for conversation:", conversationId);
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${BACKEND_URL}/api/v1/conversation/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Fetched messages:", data.data);
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchAllUsers = async (page = 1) => {
    try {
      setLoadingUsers(true);
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${BACKEND_URL}/api/v1/user/all?page=${page}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.data.users || []);
        setCurrentPage(data.data.pagination.currentPage);
        setTotalPages(data.data.pagination.totalPages);
        setTotalUsers(data.data.pagination.totalUsers);
      }
    } catch (error) {
      console.error("Error fetching all users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const startConversation = async (receiverId) => {
    try {
      setIsCreatingConversation(true);
      console.log("Starting conversation with user:", receiverId);
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${BACKEND_URL}/api/v1/conversation/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ receiverId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Conversation response:", data);
        const conversation = data.data;

        const existingConversation = conversations.find(
          (conv) => conv.id === conversation.id
        );

        if (!existingConversation) {
          setConversations((prev) => [conversation, ...prev]);
        }

        setSelectedConversation(conversation);
        setMessages([]);
        setShowNewConversation(false);
        setShowAllUsers(false);

        fetchMessages(conversation.id);
      } else {
        const errorData = await response.json();
        console.error("Failed to create conversation:", errorData);
        alert(
          `Failed to create conversation: ${
            errorData.message || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      alert("Failed to create conversation. Please try again.");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedConversation || !socket) return;

    const receiverId = selectedConversation.otherUser?.id;
    if (!receiverId) return;

    const tempMessage = {
      id: Date.now(),
      content: message.trim(),
      senderId: user.id,
      sender: { username: user.username },
      conversationId: selectedConversation.id,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setMessage("");

    socket.emit("send_message", {
      receiverId,
      content: message.trim(),
    });

    socket.emit("stop_typing", { receiverId });

    setTimeout(() => {
      setMessages((prev) =>
        prev.filter((msg) => !(msg.isTemp && msg.id === tempMessage.id))
      );
    }, 5000);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (!socket || !selectedConversation?.otherUser?.id) return;

    socket.emit("typing", {
      receiverId: selectedConversation.otherUser.id,
    });

    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("stop_typing", {
        receiverId: selectedConversation.otherUser.id,
      });
    }, 2000);
  };

  const handleConversationSelect = async (conversation) => {
    console.log("Selecting conversation:", conversation);
    console.log("Conversation ID:", conversation.id);
    console.log("Conversation ID type:", typeof conversation.id);
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);

    await markConversationAsRead(conversation.id);
  };

  const refreshConversations = async () => {
    try {
      await fetchConversations();
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  };

  const markConversationAsRead = async (conversationId) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${BACKEND_URL}/api/v1/conversation/${conversationId}/read`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Marked conversation as read:", data);

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    } catch (error) {
      console.error("Error marking conversation as read:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    window.location.href = "/auth";
  };

  const handleConversationSearch = () => {
    setIsConversationSearchOpen(true);
  };

  const handleCloseConversationSearch = () => {
    setIsConversationSearchOpen(false);
  };

  const performSearch = useCallback(async () => {
    if (!searchQuery2.trim() || searchQuery2.trim().length < 2) return;

    setSearchLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.error("No auth token found");
        setSearchResults2([]);
        return;
      }

      const endpoint = selectedConversation
        ? `${BACKEND_URL}/api/v1/conversation/${
            selectedConversation.id
          }/search?query=${encodeURIComponent(searchQuery2)}`
        : `${BACKEND_URL}/api/v1/conversation/search?query=${encodeURIComponent(
            searchQuery2
          )}`;

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults2(data.data || []);
      } else {
        console.error("Search failed:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error response:", errorText);
        setSearchResults2([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults2([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery2, selectedConversation]);

  useEffect(() => {
    if (searchQuery2.trim().length >= 2) {
      const timeoutId = setTimeout(performSearch, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults2([]);
    }
  }, [searchQuery2, selectedConversation, performSearch]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesEndRef]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Keep refs updated with latest values
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token || !user) return;

    const newSocket = io(BACKEND_URL, {
      auth: { token },
    });

    newSocket.on("connect", () => {
      console.log("Connected to socket server");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      if (error.message === "Authentication error") {
        localStorage.removeItem("auth_token");
        window.location.href = "/auth";
      }
    });

    newSocket.on("receive_message", (messageData) => {
      console.log("Received message:", messageData);
      console.log(
        "Current selected conversation:",
        selectedConversationRef.current
      );
      console.log("Message conversation ID:", messageData.conversationId);
      console.log(
        "Selected conversation ID:",
        selectedConversationRef.current?.id
      );

      const normalizedMessage = {
        ...messageData,
        sender: {
          username:
            messageData.senderName ||
            messageData.sender?.username ||
            "Unknown User",
        },
      };

      console.log("Normalized message:", normalizedMessage);

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === normalizedMessage.conversationId) {
            return { ...conv, lastMessage: normalizedMessage };
          }
          return conv;
        })
      );

      if (normalizedMessage.senderId !== user?.id) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === normalizedMessage.conversationId) {
              const currentCount = conv.unreadCount || 0;
              const newCount = Math.max(0, currentCount + 1);
              return { ...conv, unreadCount: newCount };
            }
            return conv;
          })
        );
      }

      const currentSelectedConversation = selectedConversationRef.current;
      const isCurrentConversation =
        currentSelectedConversation &&
        (normalizedMessage.conversationId === currentSelectedConversation.id ||
          String(normalizedMessage.conversationId) ===
            String(currentSelectedConversation.id));

      if (isCurrentConversation) {
        console.log("Message matches current conversation, processing...");

        if (normalizedMessage.senderId === user?.id) {
          console.log("Replacing temporary message with real message");
          setMessages((prev) =>
            prev.map((msg) =>
              msg.isTemp && msg.content === normalizedMessage.content
                ? { ...normalizedMessage, isTemp: false }
                : msg
            )
          );
        } else {
          console.log("Adding received message from other user");
          setMessages((prev) => {
            const messageExists = prev.some(
              (msg) => msg.id === normalizedMessage.id
            );
            if (!messageExists) {
              console.log("Adding new message to messages array");
              return [...prev, normalizedMessage];
            } else {
              console.log("Message already exists, skipping");
              return prev;
            }
          });

          if (
            currentSelectedConversation &&
            normalizedMessage.senderId !== user?.id
          ) {
            setTimeout(() => {
              newSocket.emit("mark_read", {
                messageId: normalizedMessage.id,
                conversationId: currentSelectedConversation.id,
              });
            }, 1000);
          }
        }
      } else {
        if (normalizedMessage.senderId !== user?.id) {
          console.log(
            "Auto-opening conversation for new message from another user"
          );

          const currentConversations = conversationsRef.current;
          const targetConversation = currentConversations.find(
            (conv) => conv.id === normalizedMessage.conversationId
          );

          if (targetConversation) {
            console.log("Auto-selecting conversation:", targetConversation);

            setSelectedConversation(targetConversation);

            setMessages([normalizedMessage]);

            setTimeout(() => {
              fetchMessages(targetConversation.id);
            }, 100);

            setTimeout(() => {
              markConversationAsRead(targetConversation.id);
            }, 500);
          }
        }
      }
    });

    newSocket.on("message_read", (readData) => {
      console.log("Message read receipt received:", readData);

      const currentSelectedConversation = selectedConversationRef.current;
      if (
        currentSelectedConversation &&
        readData.conversationId === currentSelectedConversation.id
      ) {
        console.log("Updating message read status in current conversation");
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) => {
            if (msg.id === readData.messageId) {
              const updatedMessage = {
                ...msg,
                readReceipts: [
                  ...(msg.readReceipts || []),
                  { userId: readData.userId, readAt: readData.readAt },
                ],
                isRead: true,
              };
              return updatedMessage;
            }
            return msg;
          });
          return updatedMessages;
        });
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (
            conv.id === readData.conversationId &&
            conv.lastMessage?.id === readData.messageId
          ) {
            return {
              ...conv,
              lastMessage: {
                ...conv.lastMessage,
                readReceipts: [
                  ...(conv.lastMessage.readReceipts || []),
                  { userId: readData.userId, readAt: readData.readAt },
                ],
                isRead: true,
              },
            };
          }
          return conv;
        })
      );

      if (readData.userId === user?.id) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === readData.conversationId) {
              const currentCount = conv.unreadCount || 0;
              const newCount = Math.max(0, currentCount - 1);
              return { ...conv, unreadCount: newCount };
            }
            return conv;
          })
        );
      }
    });

    newSocket.on("message_error", (errorData) => {
      const currentSelectedConversation = selectedConversationRef.current;
      if (
        currentSelectedConversation &&
        errorData.conversationId === currentSelectedConversation.id
      ) {
        setMessages((prev) =>
          prev.filter(
            (msg) => !(msg.isTemp && msg.content === errorData.content)
          )
        );
        alert("Failed to send message. Please try again.");
      }
    });

    newSocket.on("conversation_updated", (data) => {
      if (data.lastMessage) {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === data.lastMessage.conversationId) {
              return {
                ...conv,
                lastMessage: data.lastMessage,
                lastMessageAt: data.lastMessage.createdAt,
              };
            }
            return conv;
          })
        );
      }
    });

    newSocket.on("user_typing", (data) => {
      setTypingUsers((prev) => new Set(prev).add(data.username));
    });

    newSocket.on("user_stop_typing", (data) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (window.typingTimeout) {
        clearTimeout(window.typingTimeout);
      }
    };
  }, [selectedConversation]);

  const getReadReceiptIcon = (message) => {
    if (message.senderId !== user?.id) return null;

    if (message.readReceipts && message.readReceipts.length > 0) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    }
    return <Check className="w-4 h-4 text-gray-400" />;
  };

  const getReadReceiptText = (message) => {
    if (message.senderId !== user?.id) return null;

    if (message.readReceipts && message.readReceipts.length > 0) {
      const readAt = new Date(message.readReceipts[0].readAt);
      return `Read at ${readAt.toLocaleTimeString()}`;
    }
    return "Delivered";
  };

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

  const renderSearchResults = () => {
    if (searchLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-b-4 border-black mx-auto bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"></div>
        </div>
      );
    }

    if (searchResults2.length === 0 && searchQuery2.trim().length >= 2) {
      return (
        <div className="text-center py-8 text-black font-bold">
          No messages found matching &quot;{searchQuery2}&quot;
        </div>
      );
    }

    if (selectedConversation) {
      return searchResults2.map((message) => (
        <div
          key={message.id}
          className="p-4 border-b-4 border-black bg-white hover:bg-yellow-100 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500 border-2 border-black rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-black text-black">
                  {message.senderName}
                </span>
                <span className="text-sm text-black font-bold">
                  {formatDate(message.createdAt)}
                </span>
                <span className="text-xs bg-blue-400 text-black px-2 py-1 border-2 border-black font-bold">
                  {Math.round(message.similarity * 100)}% match
                </span>
              </div>
              <p className="text-black mt-1 font-bold">{message.content}</p>
            </div>
          </div>
        </div>
      ));
    } else {
      return searchResults2.map((conversation) => (
        <div
          key={conversation.conversationId}
          className="border-4 border-black mb-4 overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="bg-yellow-300 px-4 py-3 border-b-4 border-black">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-black">
                Conversation {conversation.conversationId}
              </h4>
              <span className="text-sm text-black font-bold">
                {conversation.totalMessages} messages •{" "}
                {Math.round(conversation.bestMatch * 100)}% best match
              </span>
            </div>
          </div>
          <div className="divide-y-2 divide-black">
            {conversation.messages.slice(0, 3).map((message) => (
              <div key={message.id} className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 border-2 border-black rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-black">
                        {message.senderName}
                      </span>
                      <span className="text-sm text-black font-bold">
                        {formatDate(message.createdAt)}
                      </span>
                      <span className="text-xs bg-blue-400 text-black px-2 py-1 border-2 border-black font-bold">
                        {Math.round(message.similarity * 100)}% match
                      </span>
                    </div>
                    <p className="text-black mt-1 text-sm font-bold">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {conversation.messages.length > 3 && (
              <div className="px-4 py-2 bg-yellow-100 text-center text-sm text-black font-bold border-t-2 border-black">
                +{conversation.messages.length - 3} more messages
              </div>
            )}
          </div>
        </div>
      ));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-yellow-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-b-4 border-black mx-auto bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"></div>
          <p className="mt-6 text-black font-bold text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-300">
      <div className="flex h-screen max-h-screen overflow-hidden">
        <div className="w-80 bg-green-300 border-r-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col flex-shrink-0 h-full">
          <div className="p-4 border-b-4 border-black">
            <h3 className="font-black text-black mb-3">START NEW CHAT</h3>

            {!showAllUsers ? (
              <button
                onClick={() => {
                  setShowAllUsers(true);
                  fetchAllUsers(1);
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-3 border-4 border-black rounded-none transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 mb-3"
              >
                VIEW ALL USERS
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-black">
                    ALL USERS ({totalUsers})
                  </h4>
                  <button
                    onClick={() => setShowAllUsers(false)}
                    className="text-sm bg-gray-500 hover:bg-gray-600 text-white font-black px-3 py-1 border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
                  >
                    BACK
                  </button>
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-b-4 border-black mx-auto bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"></div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-60 overflow-y-auto hide-scrollbar">
                      {allUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => startConversation(user.id)}
                          disabled={isCreatingConversation}
                          className="w-full text-left p-3 hover:bg-yellow-200 rounded-none flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
                        >
                          <div className="w-8 h-8 bg-gray-300 border-2 border-black rounded-none flex items-center justify-center">
                            <User className="w-4 h-4 text-black" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black text-black">
                              {user.username}
                              {isCreatingConversation && " (Creating...)"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t-2 border-black">
                        <button
                          onClick={() => fetchAllUsers(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-black border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                        >
                          PREV
                        </button>

                        <span className="text-sm font-black text-black">
                          {currentPage} / {totalPages}
                        </span>

                        <button
                          onClick={() => fetchAllUsers(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-black border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                        >
                          NEXT
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto min-h-0 hide-scrollbar">
            <h3 className="font-black text-black text-lg mb-4">
              CONVERSATIONS
            </h3>
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-16 h-16 text-black mx-auto mb-4" />
                <p className="text-black font-bold mb-2">
                  NO CONVERSATIONS YET
                </p>
                <p className="text-sm text-black">Start a new chat above!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                    className={`w-full text-left p-4 hover:bg-yellow-100 rounded-none border-4 border-black transition-all duration-200 relative ${
                      selectedConversation?.id === conversation.id
                        ? "bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-1 translate-y-1"
                        : "bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gray-300 border-4 border-black rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <User className="w-6 h-6 text-black" />
                        </div>
                        {hasUnreadMessages(conversation) && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 border-2 border-black rounded-none flex items-center justify-center animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <span className="text-xs text-white font-black">
                              {formatUnreadCount(getUnreadCount(conversation))}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-base font-black ${
                              hasUnreadMessages(conversation)
                                ? "text-black"
                                : "text-black"
                            }`}
                          >
                            {conversation.otherUser?.username || "Unknown User"}
                          </p>
                          {conversation.lastMessageAt && (
                            <p className="text-xs text-black font-bold">
                              {new Date(
                                conversation.lastMessageAt
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {conversation.lastMessage ? (
                          <div className="flex items-center justify-between mt-1">
                            <p
                              className={`text-sm truncate font-bold ${
                                hasUnreadMessages(conversation)
                                  ? "text-black"
                                  : "text-black"
                              }`}
                            >
                              {conversation.lastMessage.content}
                            </p>
                            <div className="flex items-center space-x-2 ml-2">
                              {conversation.lastMessage.senderId !==
                                conversation.otherUser?.id && (
                                <div className="flex items-center space-x-1">
                                  {conversation.lastMessage.readReceipts &&
                                  conversation.lastMessage.readReceipts.length >
                                    0 ? (
                                    <span className="text-xs text-green-600 font-bold">
                                      ✓✓
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              )}
                              {hasUnreadMessages(conversation) && (
                                <span className="text-xs text-red-500 font-black">
                                  {formatUnreadCount(
                                    getUnreadCount(conversation)
                                  )}{" "}
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-black italic mt-1 font-bold">
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

          <div className="p-4 border-t-4 border-black">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 border-4 border-black rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-black text-black text-lg">
                  {user.username}
                </h3>
                <p className="text-sm text-black font-bold">ONLINE</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 border-4 border-black rounded-none transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
            >
              <LogOut className="w-5 h-5 inline mr-2" />
              LOGOUT
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <MessageCircle className="w-24 h-24 text-black mx-auto mb-6" />
                <h2 className="text-3xl font-black text-black mb-4">
                  WELCOME TO CHAT
                </h2>
                <p className="text-lg text-black font-bold mb-6">
                  Select a conversation from the sidebar to start messaging
                </p>
                <button
                  onClick={() => {
                    setShowAllUsers(true);
                    fetchAllUsers(1);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-black py-4 px-8 border-4 border-black rounded-none transition-all duration-200 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 text-xl"
                >
                  VIEW ALL USERS
                </button>
              </div>
            </div>
          ) : (
            /* Chat Interface */
            <div className="flex-1 flex flex-col bg-white h-full">
              <div className="bg-yellow-300 border-b-4 border-black p-4 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-2 hover:bg-yellow-400 border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
                  >
                    <ArrowLeft className="w-5 h-5 text-black" />
                  </button>
                  <div className="w-10 h-10 bg-gray-300 border-4 border-black rounded-none flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <User className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-black text-lg">
                      {selectedConversation.otherUser?.username ||
                        "Unknown User"}
                    </h3>
                    {typingUsers.size > 0 && (
                      <p className="text-sm text-black font-bold">typing...</p>
                    )}
                  </div>
                  <button
                    onClick={handleConversationSearch}
                    className="p-2 hover:bg-yellow-400 border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
                    title="Search in conversation"
                  >
                    <Search className="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-yellow-50 to-white min-h-0 hide-scrollbar">
                {messages.map((msg, index) => (
                  <div
                    key={msg.isTemp ? `temp-${msg.id}` : `msg-${msg.id}`}
                    className={`flex ${
                      msg.senderId === user.id ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-none border-4 border-black ${
                        msg.senderId === user.id
                          ? "bg-blue-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      } ${msg.isTemp ? "opacity-70" : ""}`}
                    >
                      <p className="text-sm font-bold">{msg.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p
                          className={`text-xs font-bold ${
                            msg.senderId === user.id
                              ? "opacity-75"
                              : "text-black"
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                        {msg.senderId === user.id && (
                          <div className="flex items-center space-x-1 ml-2">
                            {getReadReceiptIcon(msg)}
                            <span className="text-xs opacity-75 font-bold">
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

              <div className="bg-white border-t-4 border-black p-4 flex-shrink-0">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    placeholder="TYPE A MESSAGE..."
                    value={message}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1 px-4 py-3 border-4 border-black rounded-none bg-yellow-100 focus:bg-white focus:outline-none focus:ring-0 focus:border-black font-bold text-black placeholder-black/60 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="px-6 py-3 bg-blue-500 text-white font-black border-4 border-black rounded-none hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isConversationSearchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b-4 border-black bg-yellow-300">
              <div className="flex items-center space-x-3">
                <Search className="w-5 h-5 text-black" />
                <h2 className="text-lg font-black text-black">
                  SEARCH IN CONVERSATION
                </h2>
              </div>
              <button
                onClick={handleCloseConversationSearch}
                className="p-2 hover:bg-yellow-400 border-2 border-black rounded-none transition-all duration-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
              >
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            <div className="p-4 border-b-4 border-black">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-black" />
                <input
                  type="text"
                  placeholder="SEARCH MESSAGES..."
                  value={searchQuery2}
                  onChange={(e) => setSearchQuery2(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-4 border-black rounded-none bg-yellow-100 focus:bg-white focus:outline-none focus:ring-0 focus:border-black font-bold text-black placeholder-black/60 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  autoFocus
                />
              </div>
              <p className="text-sm text-black font-bold mt-2">
                Type at least 2 characters to search
              </p>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar">
              {renderSearchResults()}
            </div>

            <div className="p-4 border-t-4 border-black bg-yellow-100">
              <div className="text-sm text-black font-bold text-center">
                Searching within this conversation only
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
