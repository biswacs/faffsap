import { io } from "socket.io-client";
import axios from "axios";

const BASE_URL = "http://localhost:8000";

async function testSocketConnection() {
  console.log("🧪 Testing Socket Connection...");

  try {
    console.log("1️⃣ Creating test users...");

    const user1Response = await axios.post(`${BASE_URL}/api/v1/user/register`, {
      username: `testuser1_${Date.now()}`,
      password: "testpass1",
    });

    const user2Response = await axios.post(`${BASE_URL}/api/v1/user/register`, {
      username: `testuser2_${Date.now()}`,
      password: "testpass2",
    });

    if (!user1Response.data.auth_token || !user2Response.data.auth_token) {
      throw new Error("Failed to get auth tokens");
    }

    const token1Parts = user1Response.data.auth_token.split(".");
    const token2Parts = user2Response.data.auth_token.split(".");
    const payload1 = JSON.parse(
      Buffer.from(token1Parts[1], "base64").toString()
    );
    const payload2 = JSON.parse(
      Buffer.from(token2Parts[1], "base64").toString()
    );

    const user1 = {
      id: payload1.id,
      username: user1Response.data.username || "testuser1",
      authToken: user1Response.data.auth_token,
    };

    const user2 = {
      id: payload2.id,
      username: user2Response.data.username || "testuser2",
      authToken: user2Response.data.auth_token,
    };

    console.log(`✅ User 1: ${user1.username} (ID: ${user1.id})`);
    console.log(`✅ User 2: ${user2.username} (ID: ${user2.id})`);

    console.log("\n2️⃣ Connecting users via socket...");

    const socket1 = io(BASE_URL, {
      auth: { token: user1.authToken },
    });

    const socket2 = io(BASE_URL, {
      auth: { token: user2.authToken },
    });

    await new Promise((resolve) => {
      let connectedCount = 0;

      const checkConnection = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };

      socket1.on("connect", () => {
        console.log(`✅ ${user1.username} connected`);
        checkConnection();
      });

      socket2.on("connect", () => {
        console.log(`✅ ${user2.username} connected`);
        checkConnection();
      });

      socket1.on("connect_error", (error) => {
        console.error(`❌ ${user1.username} connection failed:`, error.message);
      });

      socket2.on("connect_error", (error) => {
        console.error(`❌ ${user2.username} connection failed:`, error.message);
      });
    });

    console.log("\n3️⃣ Testing message sending...");

    let messageReceived = false;

    socket2.on("receive_message", (data) => {
      console.log(`📨 ${user2.username} received message:`, data.content);
      messageReceived = true;
    });

    socket1.on("message_sent", (data) => {
      console.log(
        `✅ ${user1.username} message sent successfully:`,
        data.content
      );
    });

    socket1.emit("send_message", {
      receiverId: user2.id,
      content: "Hello from test user 1!",
      messageType: "text",
    });

    await new Promise((resolve) => {
      setTimeout(() => {
        if (messageReceived) {
          console.log("✅ Message received successfully!");
        } else {
          console.log("❌ Message not received within timeout");
        }
        resolve();
      }, 3000);
    });

    console.log("\n4️⃣ Cleaning up...");
    socket1.disconnect();
    socket2.disconnect();

    console.log("\n🎉 Socket test completed successfully!");
    console.log("💡 Your socket system is working correctly!");
  } catch (error) {
    console.error("❌ Socket test failed:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

testSocketConnection().catch(console.error);
