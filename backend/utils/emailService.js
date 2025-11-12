import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  console.warn('⚠️  SENDGRID_API_KEY environment variable is not set. Email functionality will be unavailable.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Send an email using SendGrid
 * @param {string} email - Recipient email address
 * @param {string} text - Email body text
 * @param {string} subject - Email subject (optional, defaults to "Notification")
 * @param {string} fromEmail - Sender email (optional, uses SENDGRID_FROM_EMAIL or default)
 * @returns {Promise<Object>} SendGrid response
 */
export async function sendEmail(email, text, subject = 'Notification', fromEmail = null) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key is not configured. Please set SENDGRID_API_KEY in your environment variables.');
  }

  if (!email || !text) {
    throw new Error('Email address and text are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address format');
  }

  // Use configured from email or default
  const from = fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';

  const msg = {
    to: email,
    from: from,
    subject: subject,
    text: text,
    html: `<p>${text.replace(/\n/g, '<br>')}</p>`, // Convert newlines to <br> for HTML
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`✅ Email sent successfully to ${email}`);
    return {
      success: true,
      message: 'Email sent successfully',
      response: response
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    if (error.response) {
      // SendGrid API error
      const { body, statusCode } = error.response;
      throw new Error(`SendGrid API error (${statusCode}): ${JSON.stringify(body)}`);
    }
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send a simple email with just text and email parameters
 * @param {string} email - Recipient email address
 * @param {string} text - Email body text
 * @returns {Promise<Object>} SendGrid response
 */
export async function sendSimpleEmail(email, text) {
  return sendEmail(email, text);
}

export default {
  sendEmail,
  sendSimpleEmail
};

