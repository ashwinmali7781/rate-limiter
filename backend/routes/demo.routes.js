import { Router } from "express";

const router = Router();

// Public-ish endpoints for testing rules against - the rateLimiter
// middleware (mounted globally in server.js) applies to all of these.
router.get("/ping", (req, res) => res.json({ pong: true, at: Date.now() }));
router.get("/orders", (req, res) => res.json({ orders: [] }));
router.post("/orders", (req, res) => res.status(201).json({ created: true }));

export default router;
