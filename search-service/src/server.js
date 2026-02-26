require("dotenv").config()
const express = require("express");
const mongoose = require('mongoose')
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { consumeEvent, connectToRabbitMQ } = require("./utils/rabbitmq");
const searchRoutes = require("./routes/search-routes");
const { handlerPostCreated, handlerPostDeleted } = require("./eventHandlers/search-event-handler");

const app = express();
const PORT = process.env.PORT || 3004;

// Connect to mongodb
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongo connection error", e));

const redisClient = new Redis(process.env.REDIS_URL);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

app.use(
  "/api/search",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  searchRoutes,
);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();

    // Consume the event / subscribe to the event 
    await consumeEvent('post.created', handlerPostCreated)
    await consumeEvent('post.deleted', handlerPostDeleted)

    app.listen(PORT, () => {
      logger.info(`Post service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
  }
}
startServer();

// unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason", reason);
});
