import { io } from "socket.io-client";
import { performance } from "perf_hooks";
import axios from "axios";

const CONFIG = {
  baseUrl: "http://localhost:8000",
  maxConcurrentUsers: Infinity,
  messagesPerUser: Infinity,
  failureThreshold: 100,
  testDuration: Infinity,
  rampUpTime: 5000,
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
    console.log(`🔧 Creating ${count} test users CONCURRENTLY...`);

    const userPromises = [];
    for (let i = 0; i < count; i++) {
      const username = `loadtestuser${i + 1}_${Date.now()}`;
      const password = `testpass${i + 1}`;

      const userPromise = axios
        .post(`${this.baseUrl}/api/v1/user/register`, {
          username,
          password,
        })
        .then((response) => {
          if (response.data.auth_token) {
            const tokenParts = response.data.auth_token.split(".");
            const payload = JSON.parse(
              Buffer.from(tokenParts[1], "base64").toString()
            );

            return {
              id: payload.id,
              username,
              password,
              authToken: response.data.auth_token,
            };
          }
        })
        .catch((error) => {
          console.error(
            `❌ Failed to create user ${username}:`,
            error.response?.data?.message || error.message
          );
          return null;
        });

      userPromises.push(userPromise);
    }

    const results = await Promise.all(userPromises);
    this.users = results.filter((user) => user !== null);

    console.log(`✅ Created ${this.users.length} test users concurrently`);
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
    if (!this.connected) {
      throw new Error("User not connected");
    }

    this.lastMessageTime = performance.now();

    return new Promise((resolve, reject) => {
      try {
        this.socket.emit("send_message", {
          receiverId: receiverId,
          content: `Test message ${this.messageCount + 1} from ${
            this.username
          }`,
          messageType: "text",
        });

        setTimeout(() => resolve(), 100);
      } catch (error) {
        console.error(`Error sending message from ${this.username}:`, error);
        results.failedMessages++;
        reject(error);
      }
    });
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
    this.failureCount = 0;
    this.maxFailures = 100;
    this.startTime = Date.now();
  }

  async start() {
    console.log("🚀 Starting UNLIMITED Load Test...");
    console.log("🎯 Goal: Find the REAL breaking point");
    console.log("⏹️  Stop Condition: 100 API failures");
    console.log("=" * 50);

    this.testRunning = true;

    try {
      while (this.testRunning && this.failureCount < this.maxFailures) {
        console.log(
          `\n🔄 Test round - Users: ${this.users.length}, Failures: ${this.failureCount}/${this.maxFailures}`
        );

        await this.createAndConnectUsers(5);
        await this.sendMessagesUntilFailure();

        if (this.failureCount >= this.maxFailures) {
          console.log(
            `🚨 Hit failure threshold: ${this.failureCount} failures`
          );
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("❌ Test error:", error);
    } finally {
      this.testRunning = false;
      this.generateReport();
    }
  }

  async createAndConnectUsers(batchSize) {
    console.log(`🔧 Creating batch of ${batchSize} users...`);

    try {
      const newUsers = await this.userManager.createTestUsers(batchSize);

      if (!newUsers || newUsers.length === 0) {
        console.log("⚠️  No new users created, skipping connection");
        return;
      }

      const connectionPromises = newUsers.map((userData) => {
        const user = new SimulatedUser(
          userData.id,
          userData.username,
          userData.authToken
        );
        return user
          .connect()
          .then(() => {
            this.users.push(user);
            results.totalUsers++;
            console.log(
              `✅ User ${userData.username} connected (Total: ${this.users.length})`
            );
            return user;
          })
          .catch((error) => {
            this.failureCount++;
            console.error(
              `❌ Connection failed: ${error.message} (Failures: ${this.failureCount}/${this.maxFailures})`
            );
            return null;
          });
      });

      const connectedUsers = await Promise.all(connectionPromises);
      const successfulConnections = connectedUsers.filter((u) => u !== null);

      console.log(
        `✅ Batch complete: ${successfulConnections.length}/${batchSize} users connected`
      );
      console.log(
        `📊 Total users: ${this.users.length}, Failures: ${this.failureCount}`
      );
    } catch (error) {
      this.failureCount++;
      console.error(
        `❌ Batch creation failed: ${error.message} (Failures: ${this.failureCount}/${this.maxFailures})`
      );
    }
  }

  async sendMessagesUntilFailure() {
    if (this.users.length === 0) {
      console.log("⚠️  No users connected, skipping message test");
      return;
    }

    console.log("📝 Sending messages until failure...");

    let messageCount = 0;
    const maxMessagesPerRound = 50;

    while (
      this.failureCount < this.maxFailures &&
      messageCount < maxMessagesPerRound
    ) {
      const messagePromises = [];

      for (const user of this.users) {
        if (user.connected) {
          const otherUsers = this.users.filter(
            (u) => u.userId !== user.userId && u.connected
          );
          if (otherUsers.length > 0) {
            const randomReceiver =
              otherUsers[Math.floor(Math.random() * otherUsers.length)];

            const messagePromise = user
              .sendMessage(randomReceiver.userId)
              .then(() => {
                results.successfulMessages++;
                messageCount++;
              })
              .catch((error) => {
                this.failureCount++;
                console.error(
                  `❌ Message failed: ${error.message} (Failures: ${this.failureCount}/${this.maxFailures})`
                );
              });

            messagePromises.push(messagePromise);
          }
        }
      }

      if (messagePromises.length > 0) {
        await Promise.all(messagePromises);
      }

      if (this.failureCount >= this.maxFailures) {
        console.log(`🚨 Hit failure threshold: ${this.failureCount} failures`);
        break;
      }
    }
  }

  async cleanup() {
    console.log("🧹 Cleaning up connections...");

    for (const user of this.users) {
      if (user.disconnect) {
        user.disconnect();
      }
    }

    this.users = [];
    this.testRunning = false;
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;

    console.log("\n" + "=" * 60);
    console.log("📊 LOAD TEST RESULTS");
    console.log("=" * 60);

    const messagesPerSecond =
      results.totalMessages > 0 ? results.totalMessages / duration : 0;
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
    console.log(`🚨 Total Failures: ${this.failureCount}`);

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
    if (this.failureCount >= this.maxFailures) {
      console.log(
        `🚨 System reached breaking point at ${results.totalUsers} users`
      );
      console.log(`💡 Breaking Point: ${results.totalUsers} concurrent users`);
      console.log(
        `💡 Production Limit: ${Math.floor(
          results.totalUsers * 0.8
        )} users (80% of breaking point)`
      );
    } else {
      console.log("✅ Test completed without reaching failure threshold");
    }

    if (avgResponseTime > 1000) {
      console.log("⚠️  High response times detected (>1s)");
    }
    if (successRate < 95 && results.totalMessages > 0) {
      console.log("⚠️  Low success rate detected (<95%)");
    }

    console.log("\n💡 RECOMMENDATIONS:");
    if (this.failureCount >= this.maxFailures) {
      console.log("  - System capacity reached, consider upgrading resources");
      console.log("  - Implement connection pooling and rate limiting");
    } else if (results.totalUsers >= 20) {
      console.log("  - System approaching estimated breaking point");
      console.log("  - Monitor closely, prepare for scaling");
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
