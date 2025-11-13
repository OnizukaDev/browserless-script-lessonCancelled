import { Router } from "express";
import { validateApiKey } from "../middleware/auth";
import { ScriptsController } from "../controllers/scripts.controller";

const router = Router();

const scriptsController = new ScriptsController();

router.use(validateApiKey);

router.post("/lessons-cancelled", scriptsController.handleLessonsCancelledScript);

export const scriptsRoutes = router;
