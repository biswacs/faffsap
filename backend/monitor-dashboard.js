import os from "os";

class SystemMonitor {
  constructor() {
    this.startTime = Date.now();
  }

  getMemoryInfo() {
    const used = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    return {
      rss: Math.round(used.rss / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
      memoryUsagePercent: Math.round(memoryUsagePercent),
      freeMemory: Math.round(freeMemory / 1024 / 1024),
      totalMemory: Math.round(totalMemory / 1024 / 1024),
    };
  }

  getCPUInfo() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      cores: cpus.length,
      loadAverage1: loadAvg[0].toFixed(2),
      loadAverage5: loadAvg[1].toFixed(2),
      loadAverage15: loadAvg[2].toFixed(2),
    };
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      pid: process.pid,
    };
  }

  displayDashboard() {
    console.clear();

    const memory = this.getMemoryInfo();
    const cpu = this.getCPUInfo();
    const system = this.getSystemInfo();

    console.log("==========================================================");
    console.log("                    FAFFSAP SYSTEM MONITOR               ");
    console.log("==========================================================");
    console.log("");

    console.log("MEMORY USAGE:");
    console.log("-------------");
    console.log(`Total Memory:     ${memory.totalMemory} MB`);
    console.log(
      `Used Memory:      ${memory.totalMemory - memory.freeMemory} MB`
    );
    console.log(`Free Memory:      ${memory.freeMemory} MB`);
    console.log(`Usage:            ${memory.memoryUsagePercent}%`);
    console.log("");
    console.log(`RSS:              ${memory.rss} MB`);
    console.log(`Heap Used:        ${memory.heapUsed} MB`);
    console.log(`Heap Total:       ${memory.heapTotal} MB`);
    console.log(`External:         ${memory.external} MB`);
    console.log("");

    if (memory.memoryUsagePercent > 90) {
      console.log("🚨 CRITICAL: Memory usage above 90%!");
    } else if (memory.memoryUsagePercent > 80) {
      console.log("⚠️  WARNING: Memory usage above 80%");
    } else if (memory.memoryUsagePercent > 60) {
      console.log("📈 NOTICE: Memory usage above 60%");
    } else {
      console.log("✅ OK: Memory usage normal");
    }
    console.log("");

    console.log("CPU & SYSTEM:");
    console.log("--------------");
    console.log(`Platform:         ${system.platform}`);
    console.log(`Architecture:     ${system.arch}`);
    console.log(`CPU Cores:        ${cpu.cores}`);
    console.log(`Node Version:     ${system.nodeVersion}`);
    console.log(`Process ID:       ${system.pid}`);
    console.log("");
    console.log(`Load Average (1m):  ${cpu.loadAverage1}`);
    console.log(`Load Average (5m):  ${cpu.loadAverage5}`);
    console.log(`Load Average (15m): ${cpu.loadAverage15}`);
    console.log("");

    const load1 = parseFloat(cpu.loadAverage1);
    if (load1 > cpu.cores * 0.8) {
      console.log("🚨 CRITICAL: High CPU load detected!");
    } else if (load1 > cpu.cores * 0.6) {
      console.log("⚠️  WARNING: Elevated CPU load");
    } else {
      console.log("✅ OK: CPU load normal");
    }
    console.log("");

    console.log("PERFORMANCE:");
    console.log("-------------");
    console.log(`Uptime:           ${Math.floor(system.uptime / 60)} min`);
    console.log(`Last Update:      ${new Date().toISOString()}`);
    console.log("");

    console.log("CAPACITY ANALYSIS:");
    console.log("------------------");

    const estimatedUsers = Math.floor((1024 - memory.heapUsed) / 25);
    const memoryStatus =
      memory.memoryUsagePercent > 80
        ? "🚨 CRITICAL"
        : memory.memoryUsagePercent > 60
        ? "⚠️  WARNING"
        : "✅ OK";

    console.log(`Current Memory:   ${memoryStatus}`);
    console.log(`Estimated Users:  ${estimatedUsers} concurrent`);
    console.log(`Breaking Point:   25-35 users (estimated)`);
    console.log("");

    if (estimatedUsers < 20) {
      console.log("💡 RECOMMENDATION: Consider upgrading server resources");
    } else if (estimatedUsers < 30) {
      console.log("💡 RECOMMENDATION: Monitor closely, prepare for scaling");
    } else {
      console.log("💡 RECOMMENDATION: System operating within capacity");
    }
    console.log("");

    console.log("==========================================================");
    console.log("Press Ctrl+C to exit | Auto-refresh every 5s");
    console.log("==========================================================");
  }

  start() {
    console.log("🚀 Starting System Monitor...");
    console.log("📊 Monitoring system resources every 5 seconds...");
    console.log("");

    this.displayDashboard();

    setInterval(() => {
      this.displayDashboard();
    }, 5000);
  }
}

const monitor = new SystemMonitor();

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down monitor...");
  process.exit(0);
});

monitor.start();
