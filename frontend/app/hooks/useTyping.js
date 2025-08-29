import { useState, useEffect } from "react";

export function useTyping(socket) {
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!socket) return;

    socket.on("user_typing", (data) => {
      setTypingUsers((prev) => new Set(prev).add(data.username));
    });

    socket.on("user_stop_typing", (data) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    });

    return () => {
      socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, [socket]);

  return { typingUsers };
}
