import { Router, type IRouter } from "express";
import healthRouter from "./health";
import socialRouter from "./social";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(socialRouter);

export default router;
