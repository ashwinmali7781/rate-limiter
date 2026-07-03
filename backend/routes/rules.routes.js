import { Router } from "express";
import { requireSignedIn, requireAdmin } from "../middleware/auth.js";
import { listRules, createRule, updateRule, deleteRule, toggleRule } from "../controllers/rules.controller.js";

const router = Router();

router.use(requireSignedIn, requireAdmin);

router.get("/", listRules);
router.post("/", createRule);
router.patch("/:id", updateRule);
router.delete("/:id", deleteRule);
router.patch("/:id/toggle", toggleRule);

export default router;
