const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

// create unique name
const EXCHANGE_NAME = "facebook_event";
async function connectToRabbitMQ() {
  try {
    // connect the rabbitmq with nodejs
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // create the queue
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
    logger.info("Connected to rabbit mq");
    return channel;
  } catch (e) {
    logger.error("Error connecting rabbitmq", e);
  }
}

// publish the event 
async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message)),
  );
  logger.info(`Event published: ${routingKey}`);
}
module.exports = { connectToRabbitMQ, publishEvent };
