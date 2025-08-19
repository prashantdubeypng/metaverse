import { Producer, Consumer } from 'kafkajs';

declare global {
  var kafkaProducer: Producer | undefined;
  var kafkaConsumer: Consumer | undefined;
}

export {};
