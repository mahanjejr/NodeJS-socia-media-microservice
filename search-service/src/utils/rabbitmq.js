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

async function consumeEvent(routingKey, callback) {
  try {
    if (!channel) {
      await connectToRabbitMQ();
    }

    const q = await channel.assertQueue("", { exclusive: true });
    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);
    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        callback(content);
        channel.ack(msg);
      }
    });

    logger.info(`Subscribed to event: ${routingKey}`);
  } catch (error) {
    logger.error("Consume error", error);
  }
}

module.exports = { connectToRabbitMQ, consumeEvent };
