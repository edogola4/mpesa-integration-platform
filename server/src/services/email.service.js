//server/src/services/email.service.js

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Configure email transporter
 */
const createTransporter = () => {
  // For development - use ethereal.email (fake SMTP service)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  
  // For production
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.text - Plain text content
 * @param {String} options.html - HTML content
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `M-Pesa Integration Platform <${process.env.EMAIL_FROM || 'noreply@mpesa-platform.com'}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    
    // For development - log test URL
    if (process.env.NODE_ENV === 'development' && info.messageId) {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send verification email
 * @param {String} email - Recipient email
 * @param {String} token - Verification token
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Email Verification - M-Pesa Integration Platform',
    text: `Welcome to the M-Pesa Integration Platform! Please verify your email by clicking on the following link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to the M-Pesa Integration Platform!</h2>
        <p>Thank you for registering. To complete your registration, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>If you did not create an account, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #777; font-size: 12px;">© ${new Date().getFullYear()} M-Pesa Integration Platform. All rights reserved.</p>
      </div>
    `
  });
};

/**
 * Send password reset email
 * @param {String} email - Recipient email
 * @param {String} token - Password reset token
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Password Reset - M-Pesa Integration Platform',
    text: `You are receiving this email because you (or someone else) has requested a password reset. Please click on the following link to reset your password: ${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This password reset link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #777; font-size: 12px;">© ${new Date().getFullYear()} M-Pesa Integration Platform. All rights reserved.</p>
      </div>
    `
  });
};

/**
 * Send transaction notification email
 * @param {String} email - Recipient email
 * @param {Object} transaction - Transaction object
 * @returns {Promise<Object>} - Nodemailer info object
 */
const sendTransactionNotificationEmail = async (email, transaction) => {
  return sendEmail({
    to: email,
    subject: `Transaction ${transaction.status.toUpperCase()} - M-Pesa Integration Platform`,
    text: `Transaction Reference: ${transaction.internalReference}\nStatus: ${transaction.status}\nAmount: ${transaction.amount} ${transaction.currency}\nPhone Number: ${transaction.phoneNumber}\nTimestamp: ${new Date(transaction.updatedAt).toLocaleString()}\n\nLog in to your dashboard for more details.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Transaction Notification</h2>
        <p>We're writing to inform you about the following transaction:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <p><strong>Transaction Reference:</strong> ${transaction.internalReference}</p>
          <p><strong>Status:</strong> <span style="color: ${transaction.status === 'completed' ? '#4CAF50' : transaction.status === 'failed' ? '#F44336' : '#FF9800'}">${transaction.status.toUpperCase()}</span></p>
          <p><strong>Amount:</strong> ${transaction.amount} ${transaction.currency}</p>
          <p><strong>Phone Number:</strong> ${transaction.phoneNumber}</p>
          <p><strong>Timestamp:</strong> ${new Date(transaction.updatedAt).toLocaleString()}</p>
        </div>
        
        <p>You can view more details by logging into your dashboard:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard/transactions/${transaction._id}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Transaction</a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #777; font-size: 12px;">© ${new Date().getFullYear()} M-Pesa Integration Platform. All rights reserved.</p>
      </div>
    `
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTransactionNotificationEmail
};