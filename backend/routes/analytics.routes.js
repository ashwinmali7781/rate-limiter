import { Router } from "express";
import { requireSignedIn, requireAdmin } from "../middleware/auth.js";
import {
  getSummary,
  getTimeseries,
  getAlgorithmUsage,
  getTopClients,
  getTopEndpoints,
  listRequestLogs,
} from "../controllers/analytics.controller.js";

const router = Router();

router.use(requireSignedIn, requireAdmin);

router.get("/summary", getSummary);
router.get("/timeseries", getTimeseries);
router.get("/algorithm-usage", getAlgorithmUsage);
router.get("/top-clients", getTopClients);
router.get("/top-endpoints", getTopEndpoints);
router.get("/logs", listRequestLogs);

export default router;
