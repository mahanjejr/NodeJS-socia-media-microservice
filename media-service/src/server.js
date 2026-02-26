require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const mediaRoutes = require("./routes/media-routes");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const { handlerPostDeleted } = require("./controllers/eventHandlers/media-event-handler");

const app = express();
const PORT = process.env.PORT || 3004;

// Connect to mongodb
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongo connection error", e));

// middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Requset body, ${req.body}`);
  next();
});

// Implement IP based rate limiting for sensitive endpoints

app.use("/api/media", mediaRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ(); 

    // Consume all the events
    await consumeEvent('post.deleted', handlerPostDeleted)
    
    app.listen(PORT, () => {
      logger.info(`Media services running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}
startServer();

// Unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason", reason);
}); 
