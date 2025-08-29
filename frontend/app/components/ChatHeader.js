import { User } from "lucide-react";

export default function ChatHeader({ conversation, typingUsers, onBack }) {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">
            {conversation.otherUser?.username || "Unknown User"}
          </h3>
          {typingUsers.size > 0 && (
            <p className="text-sm text-gray-500">typing...</p>
          )}
        </div>
      </div>
    </div>
  );
}
