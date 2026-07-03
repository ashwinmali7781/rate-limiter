import { Router } from "express";
import { requireSignedIn } from "../middleware/auth.js";
import { listApiKeys, generateApiKey, revokeApiKey } from "../controllers/apikeys.controller.js";

const router = Router();

router.use(requireSignedIn);

router.get("/", listApiKeys);
router.post("/", generateApiKey);
router.post("/:id/revoke", revokeApiKey);

export default router;
