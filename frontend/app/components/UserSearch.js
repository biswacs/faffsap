import { Search, User } from "lucide-react";

export default function UserSearch({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  isCreatingConversation,
  onSearch,
  onStartConversation,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Start a New Conversation
      </h3>
      <div className="relative">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && onSearch()}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Search Results
          </h4>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => onStartConversation(user.id)}
                disabled={isCreatingConversation}
                className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
              >
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {user.username}
                    {isCreatingConversation && " (Creating...)"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
