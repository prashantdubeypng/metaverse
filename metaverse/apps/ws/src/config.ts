export const jwt_password = process.env.JWT_SECRET || '123bsdkmcbcanu';
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
export const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

// Kafka configuration helper
export const getKafkaConfig = () => {
    return {
        broker: process.env.KAFKA_BROKER || 'localhost:9092',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
        topic: process.env.KAFKA_TOPIC || 'message',
        ssl: !!process.env.KAFKA_BROKER?.includes('aivencloud.com')
    };
};