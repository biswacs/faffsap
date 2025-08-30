import { LogOut, User, Search } from "lucide-react";

export default function Header({ user, onLogout, onGlobalSearch }) {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{user.username}</h2>
            <p className="text-sm text-gray-500">Online</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onGlobalSearch}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Search all messages"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
