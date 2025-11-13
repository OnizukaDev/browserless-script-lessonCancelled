const redisURL = process.env.REDIS_URL
  ? new URL(process.env.REDIS_URL)
  : new URL("redis://localhost:6379");

export const redisConfig = {
  host: redisURL.hostname,
  port: parseInt(redisURL.port || "6379"),
  username: redisURL.username || "",
  password: redisURL.password || "",
  family: 0,
};
