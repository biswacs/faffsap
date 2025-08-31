"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "../../config";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      router.push("/");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessageText("");

    console.log("BACKEND_URL value:", BACKEND_URL);
    console.log("BACKEND_URL type:", typeof BACKEND_URL);

    try {
      const endpoint = isLogin
        ? `${BACKEND_URL}/api/v1/user/login`
        : `${BACKEND_URL}/api/v1/user/register`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("auth_token", data.auth_token);
        setMessageText("Success!");
        setUsername("");
        setPassword("");

        router.push("/");
      } else {
        setMessageText(data.message || "Error occurred");
      }
    } catch (error) {
      setMessageText("Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setMessageText("");
    setUsername("");
    setPassword("");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-yellow-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-b-4 border-black mx-auto bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"></div>
          <p className="mt-6 text-black font-bold text-lg">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-300 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md transform hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
        <h2 className="text-4xl font-black text-black mb-8 text-center tracking-tight">
          {isLogin ? "LOGIN" : "REGISTER"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="USERNAME"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 border-4 border-black rounded-none bg-yellow-100 focus:bg-white focus:outline-none focus:ring-0 focus:border-black font-bold text-black placeholder-black/60 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border-4 border-black rounded-none bg-yellow-100 focus:bg-white focus:outline-none focus:ring-0 focus:border-black font-bold text-black placeholder-black/60 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
              required
            />
          </div>

          {messageText && (
            <div
              className={`text-lg font-bold p-3 border-4 border-black ${
                messageText === "Success!"
                  ? "bg-green-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-red-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              {messageText}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 border-4 border-black rounded-none transition-all duration-200 disabled:opacity-50 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 text-xl tracking-wide"
          >
            {loading ? "LOADING..." : isLogin ? "LOGIN" : "REGISTER"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={toggleMode}
            className="text-black hover:text-blue-600 font-bold text-lg underline decoration-4 underline-offset-4 hover:decoration-blue-600 transition-all duration-200"
          >
            {isLogin ? "Need an account? REGISTER" : "Have an account? LOGIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
