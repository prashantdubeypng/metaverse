/**
 * Email Worker - Processes email queue
 * Run this as a separate process: npx tsx src/workers/emailWorker.ts
 * 
 * In production, use:
 * - AWS SES
 * - SendGrid
 * - Mailgun
 * - Postmark
 */

import { dequeueEmail, getEmailQueueDepth } from '../infra/emailQueue';
import { getEmailTemplate } from '../templates/emailTemplates';

// Simulated email sending (replace with actual email service)
async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  console.log('='.repeat(60));
  console.log('📧 EMAIL SENT');
  console.log('='.repeat(60));
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('---');
  console.log('HTML Preview:');
  console.log(html.substring(0, 500) + '...');
  console.log('---');
  console.log('Text Preview:');
  console.log(text.substring(0, 300) + '...');
  console.log('='.repeat(60));
  
  // In production, replace with actual email service:
  /*
  // AWS SES Example:
  const AWS = require('aws-sdk');
  const ses = new AWS.SES({ region: 'us-east-1' });
  
  await ses.sendEmail({
    Source: 'noreply@yourdomain.com',
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
        Text: { Data: text }
      }
    }
  }).promise();
  
  // SendGrid Example:
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  await sgMail.send({
    to,
    from: 'noreply@yourdomain.com',
    subject,
    text,
    html
  });
  */
}

/**
 * Process email queue
 */
async function processEmailQueue(): Promise<void> {
  console.log('📧 Email worker started');
  console.log('Polling queue for emails...\n');
  
  let processedCount = 0;
  let errorCount = 0;
  
  while (true) {
    try {
      // Get queue depth for monitoring
      const queueDepth = await getEmailQueueDepth();
      
      if (queueDepth > 100) {
        console.warn(`⚠️  High queue depth: ${queueDepth} emails pending`);
      }
      
      // Dequeue email job
      const job = await dequeueEmail();
      
      if (!job) {
        // No emails in queue, wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Get email template
      const { html, text } = getEmailTemplate(job.template, job.data);
      
      // Send email
      await sendEmail(job.to, job.subject, html, text);
      
      processedCount++;
      console.log(`✓ Email sent successfully (${processedCount} total)`);
      
      // Small delay to prevent overwhelming email service
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      errorCount++;
      console.error(`✗ Error processing email (${errorCount} errors):`, error);
      
      // Wait longer on error to prevent rapid retries
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('\n📧 Email worker shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📧 Email worker shutting down gracefully...');
  process.exit(0);
});

// Start worker
processEmailQueue().catch(error => {
  console.error('Fatal error in email worker:', error);
  process.exit(1);
});
