import { redis } from './redisClient';

export interface EmailJob {
  to: string;
  subject: string;
  template: 'password_reset' | 'password_changed' | 'welcome';
  data: Record<string, any>;
}

/**
 * Enqueue an email job to be processed by a worker
 * Uses Redis list as a simple queue
 */
export async function enqueueEmail(job: EmailJob): Promise<void> {
  try {
    await redis.lpush('queue:email', JSON.stringify(job));
    console.log(`📧 Email queued: ${job.template} to ${job.to}`);
  } catch (error) {
    console.error('Failed to enqueue email:', error);
    throw error;
  }
}

/**
 * Get queue depth (for monitoring)
 */
export async function getEmailQueueDepth(): Promise<number> {
  try {
    return await redis.llen('queue:email');
  } catch (error) {
    console.error('Failed to get queue depth:', error);
    return 0;
  }
}

/**
 * Dequeue an email job (for worker process)
 */
export async function dequeueEmail(): Promise<EmailJob | null> {
  try {
    const result = await redis.rpop('queue:email');
    if (!result) return null;
    return JSON.parse(result);
  } catch (error) {
    console.error('Failed to dequeue email:', error);
    return null;
  }
}
