import { useState, useEffect, useCallback } from "react";
import { Search, X, MessageSquare, User } from "lucide-react";

export default function SearchInterface({
  isOpen,
  onClose,
  conversationId = null,
  currentUserId,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.error("No auth token found");
        setResults([]);
        return;
      }

      const endpoint = conversationId
        ? `https://termi.favrapp.in/api/v1/conversation/${conversationId}/search?query=${encodeURIComponent(
            query
          )}`
        : `https://termi.favrapp.in/api/v1/conversation/search?query=${encodeURIComponent(
            query
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
        setResults(data.data || []);
      } else {
        console.error("Search failed:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error response:", errorText);
        setResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, conversationId]);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const timeoutId = setTimeout(performSearch, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
    }
  }, [query, conversationId, performSearch]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderSearchResults = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (results.length === 0 && query.trim().length >= 2) {
      return (
        <div className="text-center py-8 text-gray-500">
          No messages found matching &quot;{query}&quot;
        </div>
      );
    }

    if (conversationId) {
      // Single conversation search results
      return results.map((message) => (
        <div
          key={message.id}
          className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  {message.senderName}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(message.createdAt)}
                </span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {Math.round(message.similarity * 100)}% match
                </span>
              </div>
              <p className="text-gray-700 mt-1">{message.content}</p>
            </div>
          </div>
        </div>
      ));
    } else {
      // Global search results grouped by conversation
      return results.map((conversation) => (
        <div
          key={conversation.conversationId}
          className="border border-gray-200 rounded-lg mb-4 overflow-hidden"
        >
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">
                Conversation {conversation.conversationId}
              </h4>
              <span className="text-sm text-gray-500">
                {conversation.totalMessages} messages •{" "}
                {Math.round(conversation.bestMatch * 100)}% best match
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {conversation.messages.slice(0, 3).map((message) => (
              <div key={message.id} className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {message.senderName}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(message.createdAt)}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {Math.round(message.similarity * 100)}% match
                      </span>
                    </div>
                    <p className="text-gray-700 mt-1 text-sm">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {conversation.messages.length > 3 && (
              <div className="px-4 py-2 bg-gray-50 text-center text-sm text-gray-500">
                +{conversation.messages.length - 3} more messages
              </div>
            )}
          </div>
        </div>
      ));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Search className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {conversationId
                ? "Search in Conversation"
                : "Search All Messages"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Type at least 2 characters to search
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">{renderSearchResults()}</div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500 text-center">
            {conversationId
              ? "Searching within this conversation only"
              : "Searching across all your conversations"}
          </div>
        </div>
      </div>
    </div>
  );
}
