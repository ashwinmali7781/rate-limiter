import { Router } from "express";
import { requireSignedIn } from "../middleware/auth.js";
import { getMe } from "../controllers/me.controller.js";

const router = Router();

router.get("/", requireSignedIn, getMe);

export default router;
