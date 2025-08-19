import { Kafka } from 'kafkajs';
const kafka = new Kafka({
    clientId: 'metaverse-kafka-service',
    brokers: []
});
export async function createproducer() {
    const producer = kafka.producer();
    await producer.connect();
    return producer;
}
async function producermessage(key, message) {
}
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'metaverse-group' });
//# sourceMappingURL=index.js.map