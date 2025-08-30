"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import Header from "./components/Header";
import UserSearch from "./components/UserSearch";
import ConversationList from "./components/ConversationList";
import ChatInterface from "./components/ChatInterface";
import SearchInterface from "./components/SearchInterface";
import { useSocket } from "./hooks/useSocket";
import { useTyping } from "./hooks/useTyping";

export default function RootPage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const messagesEndRef = useRef(null);

  // Use custom hooks
  const { socket } = useSocket(
    user,
    selectedConversation,
    setMessages,
    setConversations
  );
  const { typingUsers } = useTyping(socket);

  useEffect(() => {
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
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        "http://localhost:8080/api/v1/user/profile",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
      const response = await fetch(
        "http://localhost:8080/api/v1/conversation",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
        `http://localhost:8080/api/v1/conversation/${conversationId}/messages`,
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

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:8080/api/v1/user/search?username=${searchQuery}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const startConversation = async (receiverId) => {
    try {
      setIsCreatingConversation(true);
      console.log("Starting conversation with user:", receiverId);
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        "http://localhost:8080/api/v1/conversation/create",
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

        setConversations((prev) => [conversation, ...prev]);
        setSelectedConversation(conversation);
        setMessages([]);
        setSearchResults([]);
        setSearchQuery("");

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

    // Remove temporary message after 5 seconds if not replaced
    setTimeout(() => {
      setMessages((prev) =>
        prev.filter((msg) => !(msg.isTemp && msg.id === tempMessage.id))
      );
    }, 5000);
  };

  const handleConversationSelect = async (conversation) => {
    console.log("Selecting conversation:", conversation);
    console.log("Conversation ID:", conversation.id);
    console.log("Conversation ID type:", typeof conversation.id);
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);

    // Mark conversation as read
    await markConversationAsRead(conversation.id);
  };

  const markConversationAsRead = async (conversationId) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:8080/api/v1/conversation/${conversationId}/read`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Marked conversation as read:", data);

        // Update conversations to reflect read status and reset unread count
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

  const handleGlobalSearch = () => {
    setIsGlobalSearchOpen(true);
  };

  const handleCloseGlobalSearch = () => {
    setIsGlobalSearchOpen(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        user={user}
        onLogout={handleLogout}
        onGlobalSearch={handleGlobalSearch}
      />

      {!selectedConversation ? (
        <div className="max-w-4xl mx-auto p-6">
          <UserSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            isCreatingConversation={isCreatingConversation}
            onSearch={searchUsers}
            onStartConversation={startConversation}
          />

          <ConversationList
            conversations={conversations}
            onConversationSelect={handleConversationSelect}
          />
        </div>
      ) : (
        <ChatInterface
          conversation={selectedConversation}
          messages={messages}
          message={message}
          setMessage={setMessage}
          typingUsers={typingUsers}
          currentUserId={user.id}
          messagesEndRef={messagesEndRef}
          onBack={() => setSelectedConversation(null)}
          onSendMessage={sendMessage}
        />
      )}

      <SearchInterface
        isOpen={isGlobalSearchOpen}
        onClose={handleCloseGlobalSearch}
        conversationId={null}
        currentUserId={user?.id}
      />
    </div>
  );
}
