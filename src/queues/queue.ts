import Queue from "bull";
import { redisConfig } from "../config/redis";

const scriptsQueue = new Queue("scripts-queue", {
  redis: redisConfig,
  limiter: {
    max: 1,
    duration: 180000,
  },
});

export { scriptsQueue };
