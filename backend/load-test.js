import { io } from "socket.io-client";
import { performance } from "perf_hooks";
import axios from "axios";

const CONFIG = {
  baseUrl: "http://localhost:8000",
  maxConcurrentUsers: 40,
  messagesPerUser: 10,
  messageInterval: 1000,
  testDuration: 60000,
  rampUpTime: 10000,
};

const results = {
  startTime: null,
  endTime: null,
  totalUsers: 0,
  totalMessages: 0,
  successfulMessages: 0,
  failedMessages: 0,
  averageResponseTime: 0,
  memoryUsage: [],
  errors: [],
  testUsers: [],
};

class TestUserManager {
  constructor() {
    this.users = [];
    this.baseUrl = CONFIG.baseUrl;
  }

  async createTestUsers(count) {
    console.log(`🔧 Creating ${count} test users...`);

    for (let i = 0; i < count; i++) {
      const username = `loadtestuser${i + 1}_${Date.now()}`;
      const password = `testpass${i + 1}`;

      try {
        const response = await axios.post(
          `${this.baseUrl}/api/v1/user/register`,
          {
            username,
            password,
          }
        );

        if (response.data.auth_token) {
          const tokenParts = response.data.auth_token.split(".");
          const payload = JSON.parse(
            Buffer.from(tokenParts[1], "base64").toString()
          );

          const user = {
            id: payload.id,
            username,
            password,
            authToken: response.data.auth_token,
          };

          this.users.push(user);
          console.log(
            `✅ Created test user: ${username} (DB ID: ${payload.id})`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to create user ${username}:`,
          error.response?.data?.message || error.message
        );
      }
    }

    console.log(`✅ Created ${this.users.length} test users successfully`);
    return this.users;
  }

  async cleanupTestUsers() {
    console.log("🧹 Cleaning up test users...");

    console.log(`📝 Test users created (these will remain in your database):`);
    this.users.forEach((user) => {
      console.log(`  - ${user.username} (DB ID: ${user.id})`);
    });

    console.log(
      "💡 To clean up manually, you can delete users with usernames starting with 'loadtestuser'"
    );
  }

  getRandomUser() {
    if (this.users.length === 0) return null;
    return this.users[Math.floor(Math.random() * this.users.length)];
  }

  getUserByIndex(index) {
    return this.users[index] || null;
  }
}

class SimulatedUser {
  constructor(userId, username, authToken) {
    this.userId = userId;
    this.username = username;
    this.authToken = authToken;
    this.socket = null;
    this.messageCount = 0;
    this.responseTimes = [];
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(CONFIG.baseUrl, {
          auth: {
            token: this.authToken,
          },
        });

        this.socket.on("connect", () => {
          this.connected = true;
          console.log(`User ${this.username} connected successfully`);
          resolve();
        });

        this.socket.on("connect_error", (error) => {
          console.error(
            `User ${this.username} connection failed:`,
            error.message
          );
          reject(error);
        });

        this.socket.on("message_sent", (data) => {
          const responseTime = performance.now() - this.lastMessageTime;
          this.responseTimes.push(responseTime);
          this.messageCount++;
          results.successfulMessages++;
          console.log(
            `User ${
              this.username
            } message sent successfully (${responseTime.toFixed(2)}ms)`
          );
        });

        this.socket.on("error", (error) => {
          console.error(`User ${this.username} error:`, error);
          results.errors.push({
            userId: this.userId,
            username: this.username,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        });

        this.socket.on("error", (error) => {
          console.error(`User ${this.username} socket error:`, error);
          if (
            error.message &&
            error.message.includes("Failed to send message")
          ) {
            results.failedMessages++;
          }
        });

        setTimeout(() => {
          if (!this.connected) {
            reject(new Error("Connection timeout"));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendMessage(receiverId) {
    if (!this.connected) return;

    this.lastMessageTime = performance.now();

    try {
      this.socket.emit("send_message", {
        receiverId: receiverId,
        content: `Test message ${this.messageCount + 1} from ${this.username}`,
        messageType: "text",
      });
    } catch (error) {
      console.error(`Error sending message from ${this.username}:`, error);
      results.failedMessages++;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0;
    return (
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
    );
  }
}

class LoadTest {
  constructor() {
    this.users = [];
    this.testRunning = false;
    this.userManager = new TestUserManager();
  }

  async start() {
    console.log("🚀 Starting Load Test...");
    console.log(`📊 Target: ${CONFIG.maxConcurrentUsers} concurrent users`);
    console.log(`⏱️  Duration: ${CONFIG.testDuration / 1000} seconds`);
    console.log(`📝 Messages per user: ${CONFIG.messagesPerUser}`);
    console.log("=" * 50);

    await this.userManager.createTestUsers(CONFIG.maxConcurrentUsers);

    if (this.userManager.users.length === 0) {
      console.error("❌ No test users created. Cannot proceed with load test.");
      return;
    }

    results.startTime = new Date();
    this.testRunning = true;

    await this.rampUpUsers();

    await this.runTest();

    await this.cleanup();
    this.generateReport();

    await this.userManager.cleanupTestUsers();
  }

  async rampUpUsers() {
    console.log("📈 Ramping up users...");

    const usersPerBatch = Math.ceil(
      CONFIG.maxConcurrentUsers / (CONFIG.rampUpTime / 1000)
    );

    for (
      let i = 0;
      i < Math.min(CONFIG.maxConcurrentUsers, this.userManager.users.length);
      i++
    ) {
      const testUser = this.userManager.getUserByIndex(i);
      if (!testUser) continue;

      const user = new SimulatedUser(
        testUser.id,
        testUser.username,
        testUser.authToken
      );

      try {
        await user.connect();
        this.users.push(user);
        results.totalUsers++;

        if (i % 5 === 0) {
          console.log(
            `✅ Connected ${i + 1}/${Math.min(
              CONFIG.maxConcurrentUsers,
              this.userManager.users.length
            )} users`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to connect user ${i + 1}:`, error.message);
        results.errors.push({
          userId: i + 1,
          username: testUser.username,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`✅ All ${this.users.length} users connected`);
  }

  async runTest() {
    console.log("🔄 Running main test...");

    const testStart = Date.now();

    while (Date.now() - testStart < CONFIG.testDuration && this.testRunning) {
      for (const user of this.users) {
        if (user.messageCount < CONFIG.messagesPerUser) {
          const otherUsers = this.users.filter((u) => u.userId !== user.userId);
          if (otherUsers.length > 0) {
            const randomReceiver =
              otherUsers[Math.floor(Math.random() * otherUsers.length)];

            await user.sendMessage(randomReceiver.userId);
            results.totalMessages++;

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      const allMessagesSent = this.users.every(
        (user) => user.messageCount >= CONFIG.messagesPerUser
      );
      if (allMessagesSent) {
        console.log("✅ All messages sent, ending test early");
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async cleanup() {
    console.log("🧹 Cleaning up...");

    for (const user of this.users) {
      user.disconnect();
    }

    results.endTime = new Date();
    this.testRunning = false;
  }

  generateReport() {
    console.log("\n" + "=" * 60);
    console.log("📊 LOAD TEST RESULTS");
    console.log("=" * 60);

    const duration = (results.endTime - results.startTime) / 1000;
    const messagesPerSecond = results.totalMessages / duration;
    const successRate =
      results.totalMessages > 0
        ? (results.successfulMessages / results.totalMessages) * 100
        : 0;

    const allResponseTimes = this.users.flatMap((user) => user.responseTimes);
    const avgResponseTime =
      allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : 0;

    console.log(`⏱️  Test Duration: ${duration.toFixed(2)} seconds`);
    console.log(`👥 Total Users: ${results.totalUsers}`);
    console.log(`📝 Total Messages: ${results.totalMessages}`);
    console.log(`✅ Successful Messages: ${results.successfulMessages}`);
    console.log(`❌ Failed Messages: ${results.failedMessages}`);
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`🚀 Messages/Second: ${messagesPerSecond.toFixed(2)}`);
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`🔴 Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log("\n❌ Error Summary:");
      results.errors.slice(0, 5).forEach((error) => {
        console.log(`  - User ${error.username}: ${error.error}`);
      });
      if (results.errors.length > 5) {
        console.log(`  ... and ${results.errors.length - 5} more errors`);
      }
    }

    console.log("\n📈 PERFORMANCE ANALYSIS:");
    if (results.totalUsers >= 25) {
      console.log(
        "⚠️  System approaching estimated breaking point (25-35 users)"
      );
    }
    if (avgResponseTime > 1000) {
      console.log("⚠️  High response times detected (>1s)");
    }
    if (successRate < 95) {
      console.log("⚠️  Low success rate detected (<95%)");
    }

    console.log("\n💡 RECOMMENDATIONS:");
    if (results.totalUsers >= 30) {
      console.log("  - Consider upgrading server resources");
      console.log("  - Implement connection pooling");
      console.log("  - Add rate limiting");
    }

    console.log("=" * 60);
  }
}

const loadTest = new LoadTest();

process.on("SIGINT", async () => {
  console.log("\n🛑 Stopping load test...");
  loadTest.testRunning = false;
  await loadTest.cleanup();
  process.exit(0);
});

loadTest.start().catch(console.error);
