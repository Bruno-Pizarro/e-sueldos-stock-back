/* eslint-disable no-console */
import amqp from 'amqplib';

type RoutingKeys = 'stock.create' | 'stock.update' | 'stock.delete';

const publishEvent = async (eventType: RoutingKeys, data: any) => {
  try {
    const connection = await amqp.connect(process.env['RABBITMQ_URL'] || 'amqp://localhost');
    const channel = await connection.createChannel();
    const exchange = process.env['RABBITMQ_EXCHANGE'] ?? 'topic-app-exchange';
    await channel.assertExchange(exchange, 'topic', { durable: false });

    const sent = channel.publish(exchange, eventType, Buffer.from(JSON.stringify(data)));
    if (sent) console.log('Sent %s', data);
    else console.error('Unsent message');
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error('Error connecting to RabbitMQ', error);
  }
};

export default { publishEvent };
