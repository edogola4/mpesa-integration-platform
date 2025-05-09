// server/src/services/notifications/emailService.js

const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

// Create a transporter based on environment
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use a real email service in production
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    // Use ethereal.email (fake SMTP service) for development
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.DEV_EMAIL_USERNAME || 'ethereal_user',
        pass: process.env.DEV_EMAIL_PASSWORD || 'ethereal_password'
      }
    });
  }
};

// Send email with specified options
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Log email URL in development (ethereal.email provides preview URL)
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

// Send verification email
exports.sendVerificationEmail = async (email, { name, url }) => {
  return sendEmail({
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to M-Pesa Integration Platform!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>If you didn't register for an account, please ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
        <p>Regards,<br>The M-Pesa Integration Platform Team</p>
      </div>
    `
  });
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, { name, url }) => {
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>You requested to reset your password. Please click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${url}" style="background-color: #2196F3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>If you didn't request a password reset, please ignore this email or contact support if you're concerned.</p>
        <p>This link will expire in 10 minutes.</p>
        <p>Regards,<br>The M-Pesa Integration Platform Team</p>
      </div>
    `
  });
};

// Send welcome email after verification
exports.sendWelcomeEmail = async (email, { name }) => {
  return sendEmail({
    to: email,
    subject: 'Welcome to M-Pesa Integration Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to M-Pesa Integration Platform!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for verifying your email address. Your account is now fully activated.</p>
        <p>Here are some resources to help you get started:</p>
        <ul>
          <li><a href="#">Getting Started Guide</a></li>
          <li><a href="#">API Documentation</a></li>
          <li><a href="#">Dashboard Tutorial</a></li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Regards,<br>The M-Pesa Integration Platform Team</p>
      </div>
    `
  });
};

// Send notification about successful payment
exports.sendPaymentSuccessEmail = async (email, { name, amount, reference, transactionId }) => {
  return sendEmail({
    to: email,
    subject: 'Payment Successful',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Successful</h2>
        <p>Hello ${name},</p>
        <p>We're writing to confirm that your payment has been successfully processed:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Amount:</strong> ${amount}</p>
          <p><strong>Reference:</strong> ${reference}</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
        </div>
        <p>You can view the full transaction details in your dashboard.</p>
        <p>Regards,<br>The M-Pesa Integration Platform Team</p>
      </div>
    `
  });
};