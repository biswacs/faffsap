import { useState, useEffect } from "react";
import { io } from "socket.io-client";

export function useSocket(
  user,
  selectedConversation,
  setMessages,
  setConversations
) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }

    const newSocket = io("https://termi.favrapp.in", {
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
      console.log("Current selected conversation:", selectedConversation);
      console.log("Message conversation ID:", messageData.conversationId);
      console.log("Selected conversation ID:", selectedConversation?.id);
      console.log(
        "ID types - message:",
        typeof messageData.conversationId,
        "selected:",
        typeof selectedConversation?.id
      );
      console.log(
        "ID comparison result:",
        messageData.conversationId === selectedConversation?.id
      );

      // Normalize message data to match frontend expectations
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

      // Always update the conversation's last message first
      updateConversationLastMessage(normalizedMessage);

      // Update unread count for the conversation
      updateConversationUnreadCount(normalizedMessage.conversationId, 1);

      // Check if the message is for the currently selected conversation
      // Use both strict equality and string comparison for robustness
      const isCurrentConversation =
        selectedConversation &&
        (normalizedMessage.conversationId === selectedConversation.id ||
          String(normalizedMessage.conversationId) ===
            String(selectedConversation.id));

      if (isCurrentConversation) {
        console.log("Message matches current conversation, processing...");

        // If it's from the current user, replace the temporary message
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
          // If it's from another user, add it to the messages
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

          // Mark the message as read if we're in the conversation
          if (selectedConversation && normalizedMessage.senderId !== user?.id) {
            setTimeout(() => {
              newSocket.emit("mark_read", {
                messageId: normalizedMessage.id,
                conversationId: selectedConversation.id,
              });
            }, 1000); // Mark as read after 1 second
          }
        }
      } else {
        // Message is for a different conversation or no conversation is selected
        console.log(
          "Message not for current conversation or no conversation selected"
        );
        console.log(
          "Message conversation ID:",
          normalizedMessage.conversationId
        );
        console.log("Selected conversation ID:", selectedConversation?.id);
        console.log("Message sender ID:", normalizedMessage.senderId);
        console.log("Current user ID:", user?.id);

        // If no conversation is selected but we have a message,
        // we should still update the conversation list to show the new message
        if (!selectedConversation) {
          console.log(
            "No conversation selected, but updating conversation list"
          );
        }
      }
    });

    newSocket.on("message_read", (readData) => {
      console.log("Message read receipt received:", readData);
      console.log("Current selected conversation:", selectedConversation);
      console.log("Message ID to update:", readData.messageId);

      // Update the message read status in the current conversation
      if (
        selectedConversation &&
        readData.conversationId === selectedConversation.id
      ) {
        console.log("Updating message read status in current conversation");
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) => {
            if (msg.id === readData.messageId) {
              console.log("Found message to update:", msg);
              const updatedMessage = {
                ...msg,
                readReceipts: [
                  ...(msg.readReceipts || []),
                  { userId: readData.userId, readAt: readData.readAt },
                ],
                isRead: true,
              };
              console.log("Updated message:", updatedMessage);
              return updatedMessage;
            }
            return msg;
          });
          console.log("Updated messages array:", updatedMessages);
          return updatedMessages;
        });
      } else {
        console.log(
          "Not updating messages - conversation mismatch or no conversation selected"
        );
      }

      // Update conversation list to reflect read status
      setConversations((prev) =>
        prev.map((conv) => {
          if (
            conv.id === readData.conversationId &&
            conv.lastMessage?.id === readData.messageId
          ) {
            console.log("Updating conversation last message read status");
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

      // Update unread count when message is read
      if (readData.userId === user?.id) {
        console.log("Updating unread count for current user");
        updateConversationUnreadCount(readData.conversationId, -1);
      }
    });

    newSocket.on("message_error", (errorData) => {
      if (
        selectedConversation &&
        errorData.conversationId === selectedConversation.id
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
        updateConversationLastMessage(data.lastMessage);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, selectedConversation]);

  const updateConversationLastMessage = (messageData) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === messageData.conversationId) {
          return { ...conv, lastMessage: messageData };
        }
        return conv;
      })
    );
  };

  const updateConversationUnreadCount = (conversationId, increment) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id === conversationId) {
          const currentCount = conv.unreadCount || 0;
          const newCount = Math.max(0, currentCount + increment);
          return { ...conv, unreadCount: newCount };
        }
        return conv;
      })
    );
  };

  return { socket };
}
