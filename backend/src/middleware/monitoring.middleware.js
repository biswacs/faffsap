import os from "os";

export const memoryMonitor = (req, res, next) => {
  const used = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

  if (
    req.url.includes("/api") &&
    (Math.random() < 0.01 || memoryUsagePercent > 80)
  ) {
    console.log(`[MEMORY] ${new Date().toISOString()}:`, {
      rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(used.external / 1024 / 1024)} MB`,
      memoryUsagePercent: `${Math.round(memoryUsagePercent)}%`,
      freeMemory: `${Math.round(freeMemory / 1024 / 1024)} MB`,
      url: req.url,
      method: req.method,
    });

    if (memoryUsagePercent > 90) {
      console.error(
        `[CRITICAL] Memory usage at ${Math.round(memoryUsagePercent)}%!`
      );
    }
  }

  next();
};

export const socketMonitor = (io) => {
  const monitorInterval = setInterval(() => {
    const connectedSockets = io.engine.clientsCount || 0;
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent =
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;

    console.log(`[SOCKET] ${new Date().toISOString()}:`, {
      connectedSockets,
      memoryUsagePercent: `${Math.round(memoryUsagePercent)}%`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    });

    if (connectedSockets > 50) {
      console.warn(`[WARNING] High socket count: ${connectedSockets}`);
    }

    if (memoryUsagePercent > 85) {
      console.error(
        `[CRITICAL] High memory usage: ${Math.round(memoryUsagePercent)}%`
      );
    }
  }, 30000);

  return monitorInterval;
};

export const performanceMonitor = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const memoryUsage = process.memoryUsage();

    if (duration > 1000 || memoryUsage.heapUsed > 500 * 1024 * 1024) {
      console.log(`[PERFORMANCE] ${new Date().toISOString()}:`, {
        url: req.url,
        method: req.method,
        duration: `${duration}ms`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

export const dbMonitor = (sequelize) => {
  const monitorInterval = setInterval(async () => {
    try {
      const pool = sequelize.connectionManager.pool;
      const poolStatus = {
        total: pool.size,
        idle: pool.idle,
        using: pool.using,
        pending: pool.pending,
      };

      console.log(`[DATABASE] ${new Date().toISOString()}:`, poolStatus);

      if (pool.using > pool.size * 0.8) {
        console.warn(
          `[WARNING] Database connection pool at ${Math.round(
            (pool.using / pool.size) * 100
          )}% capacity`
        );
      }
    } catch (error) {
      console.error("[ERROR] Database monitoring failed:", error.message);
    }
  }, 60000);

  return monitorInterval;
};
