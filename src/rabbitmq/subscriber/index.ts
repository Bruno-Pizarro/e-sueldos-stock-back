/* eslint-disable no-console */
import amqp from 'amqplib';
import mongoose, { Document, Model } from 'mongoose';
import { User } from '../../modules/user';
import { Token } from '../../modules/token';
import { Product } from '../../modules/product';
import config from '../../config/config';

type RoutingKey =
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'products.create'
  | 'products.update'
  | 'products.delete'
  | 'token.create'
  | 'token.update'
  | 'token.delete';

const handleCreate = async (model: Model<Document>, data: any): Promise<void> => {
  const { id, ...restData } = data;
  const idd = new mongoose.Types.ObjectId(id);
  await model.create({ ...restData, _id: idd ?? data?._id, id });
};

const handleUpdate = async (model: Model<Document>, data: any): Promise<void> => {
  const document = await model.findById(data.id);
  if (document) {
    Object.assign(document, data);
    await document.save();
  }
};

const handleDelete = async (model: Model<Document>, data: any): Promise<void> => {
  const document = await model.findById(data.id);
  if (document) {
    await document.deleteOne();
  }
};

const handleMessage = async (routingKey: RoutingKey, content: any): Promise<void> => {
  const [entity, action] = routingKey.split('.') as [string, string];
  let model: Model<any> | undefined;

  switch (entity) {
    case 'users':
      model = User;
      break;
    case 'products':
      model = Product;
      break;
    case 'token':
      model = Token;
      break;
    default:
      console.warn(`Unknown entity: ${entity}`);
      return;
  }

  switch (action) {
    case 'create':
      await handleCreate(model, content);
      break;
    case 'update':
      await handleUpdate(model, content);
      break;
    case 'delete':
      await handleDelete(model, content);
      break;
    default:
      console.warn(`Unknown action: ${action}`);
  }
};

const subscriber = async () => {
  mongoose.connect(config.mongoose.url).then(() => {
    console.info('Connected to MongoDB');
  });
  const conn = process.env['RABBITMQ_URL'] || 'amqp://localhost';
  try {
    const connection = await amqp.connect(conn);
    const channel = await connection.createChannel();
    const exchange = process.env['RABBITMQ_EXCHANGE'] ?? 'topic-app-exchange';
    const queue = 'stock_updates';

    await channel.assertExchange(exchange, 'topic', { durable: false });

    await channel.assertQueue(queue, { durable: false });

    await channel.bindQueue(queue, exchange, 'users.*');
    await channel.bindQueue(queue, exchange, 'token.*');
    await channel.bindQueue(queue, exchange, 'products.*');

    channel.consume(queue, async (msg) => {
      try {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          const { routingKey } = msg.fields;

          console.log(`Received: %s${routingKey}`, content);

          await handleMessage(routingKey as RoutingKey, content);

          channel.ack(msg);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        channel.reject(msg!, false);
      }
    });
  } catch (error) {
    console.error(`Error connecting to RabbitMQ ${conn}`, error);
  }
};

subscriber();
