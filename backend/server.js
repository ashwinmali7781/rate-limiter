import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

import { connectMongo } from "./config/db.js";
import { getRedis } from "./config/redis.js";
import { withClerk } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { resolveTenant } from "./middleware/resolveTenant.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { setIo } from "./utils/socket.js";
import { register } from "./utils/metrics.js";

import rulesRoutes from "./routes/rules.routes.js";
import apiKeysRoutes from "./routes/apikeys.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import demoRoutes from "./routes/demo.routes.js";
import meRoutes from "./routes/me.routes.js";
import gatewayRoutes from "./routes/gateway.routes.js";

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || "http://localhost:5173" },
});
setIo(io);

// --- Core middleware -------------------------------------------------
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(withClerk); // attaches req.auth when a Clerk session cookie/token is present
app.use(resolveTenant); // attaches req.tenantId (defaults to "default")

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// Prometheus scrape target. In production, restrict this at the network/
// ingress layer (it's unauthenticated by Prometheus convention) rather than
// gating it behind Clerk, which scrapers can't do a browser OAuth dance with.
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// --- Rate limiting applies to demo/business endpoints, not the admin API ---
app.use("/api/demo", rateLimiter, demoRoutes);

// --- API Gateway mode: rate-limit then reverse-proxy to an upstream service
// defined on the matched rule (rule.upstreamUrl). See routes/gateway.routes.js.
app.use("/gateway", rateLimiter, gatewayRoutes);

// --- Management API (protected by Clerk auth + admin role inside routers) ---
app.use("/api/rules", rulesRoutes);
app.use("/api/keys", apiKeysRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/me", meRoutes);

app.use(notFound);
app.use(errorHandler);

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[socket] client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectMongo();
  getRedis(); // establish connection eagerly so failures surface at boot
  server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
