// server/src/services/notifications/templates.js
/**
 * Notification templates for various system events
 */

/**
 * Generate welcome email content
 * @param {Object} user - User object
 * @param {string} verificationUrl - Email verification URL
 * @returns {Object} - Email content object with html and text properties
 */
const welcomeEmail = (user, verificationUrl) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to M-Pesa Integration Platform!</h2>
        <p>Hello ${user.firstName},</p>
        <p>Thank you for registering with our M-Pesa Integration Platform. We're excited to help you integrate M-Pesa payments into your business.</p>
        
        <p>To get started, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #0066cc; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <p>Next steps after verification:</p>
        <ol>
          <li>Set up your business profile</li>
          <li>Configure your M-Pesa integration</li>
          <li>Generate API keys</li>
          <li>Test your integration in sandbox mode</li>
        </ol>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        
        <p>Best regards,<br>M-Pesa Integration Platform Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>This email was sent to ${user.email}. If you did not register for an account, please ignore this email.</p>
        </div>
      </div>
    `;
    
    const text = `
  Welcome to M-Pesa Integration Platform!
  
  Hello ${user.firstName},
  
  Thank you for registering with our M-Pesa Integration Platform. We're excited to help you integrate M-Pesa payments into your business.
  
  To get started, please verify your email address by visiting the following link:
  ${verificationUrl}
  
  Next steps after verification:
  1. Set up your business profile
  2. Configure your M-Pesa integration
  3. Generate API keys
  4. Test your integration in sandbox mode
  
  If you have any questions or need assistance, please don't hesitate to contact our support team.
  
  Best regards,
  M-Pesa Integration Platform Team
  
  ---
  This email was sent to ${user.email}. If you did not register for an account, please ignore this email.
    `;
    
    return { html, text };
  };
  
  /**
   * Generate password reset email content
   * @param {Object} user - User object
   * @param {string} resetUrl - Password reset URL
   * @returns {Object} - Email content object with html and text properties
   */
  const passwordResetEmail = (user, resetUrl) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Reset Your Password</h2>
        <p>Hello ${user.firstName},</p>
        <p>We received a request to reset your password for the M-Pesa Integration Platform. If you made this request, please click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        
        <p>This password reset link will expire in 1 hour.</p>
        
        <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account security.</p>
        
        <p>Best regards,<br>M-Pesa Integration Platform Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>This email was sent to ${user.email}. If you did not request a password reset, no action is required.</p>
        </div>
      </div>
    `;
    
    const text = `
  Reset Your Password
  
  Hello ${user.firstName},
  
  We received a request to reset your password for the M-Pesa Integration Platform. If you made this request, please use the following link to reset your password:
  
  ${resetUrl}
  
  This password reset link will expire in 1 hour.
  
  If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account security.
  
  Best regards,
  M-Pesa Integration Platform Team
  
  ---
  This email was sent to ${user.email}. If you did not request a password reset, no action is required.
    `;
    
    return { html, text };
  };
  
  /**
   * Generate API key created notification email
   * @param {Object} user - User object
   * @param {Object} business - Business object 
   * @param {Object} apiKey - API key object (excluding the secret)
   * @returns {Object} - Email content object with html and text properties
   */
  const apiKeyCreatedEmail = (user, business, apiKey) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New API Key Created</h2>
        <p>Hello ${user.firstName},</p>
        <p>A new API key has been created for your business <strong>${business.name}</strong> on the M-Pesa Integration Platform.</p>
        
        <div style="border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-top: 20px;">
          <h3 style="margin-top: 0;">API Key Details</h3>
          <p><strong>Key Name:</strong> ${apiKey.name}</p>
          <p><strong>Created:</strong> ${new Date(apiKey.createdAt).toLocaleString()}</p>
          <p><strong>Environment:</strong> ${apiKey.environment || 'Production'}</p>
        </div>
        
        <p style="margin-top: 20px; color: #dc3545; font-weight: bold;">
          Important: For security reasons, the API secret is only displayed once during creation. 
          If you did not save it, you will need to generate a new API key.
        </p>
        
        <p>You can manage your API keys in the dashboard at any time.</p>
        
        <p>Best regards,<br>M-Pesa Integration Platform Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>This is a security notification. If you did not create this API key, please revoke it immediately and contact our support team.</p>
        </div>
      </div>
    `;
    
    const text = `
  New API Key Created
  
  Hello ${user.firstName},
  
  A new API key has been created for your business ${business.name} on the M-Pesa Integration Platform.
  
  API Key Details:
  - Key Name: ${apiKey.name}
  - Created: ${new Date(apiKey.createdAt).toLocaleString()}
  - Environment: ${apiKey.environment || 'Production'}
  
  IMPORTANT: For security reasons, the API secret is only displayed once during creation. If you did not save it, you will need to generate a new API key.
  
  You can manage your API keys in the dashboard at any time.
  
  Best regards,
  M-Pesa Integration Platform Team
  
  ---
  This is a security notification. If you did not create this API key, please revoke it immediately and contact our support team.
    `;
    
    return { html, text };
  };
  
  /**
   * Generate successful payment notification for customer
   * @param {Object} transaction - Transaction object
   * @param {Object} business - Business object
   * @returns {Object} - SMS content string
   */
  const paymentSuccessSMS = (transaction, business) => {
    return `Payment of ${transaction.amount} ${transaction.currency} to ${business.name} confirmed. M-Pesa reference: ${transaction.mpesaReference}. Thank you for using our service.`;
  };
  
  /**
   * Generate alert for suspicious activity
   * @param {Object} user - User object
   * @param {Object} activity - Suspicious activity details
   * @returns {Object} - Email content object with html and text properties
   */
  const securityAlertEmail = (user, activity) => {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545;">Security Alert</h2>
        <p>Hello ${user.firstName},</p>
        <p>We detected unusual activity on your M-Pesa Integration Platform account that you should be aware of:</p>
        
        <div style="border: 1px solid #dc3545; border-radius: 4px; padding: 15px; margin-top: 20px; background-color: #fff8f8;">
          <h3 style="margin-top: 0; color: #dc3545;">Activity Details</h3>
          <p><strong>Time:</strong> ${new Date(activity.timestamp).toLocaleString()}</p>
          <p><strong>Activity:</strong> ${activity.description}</p>
          <p><strong>IP Address:</strong> ${activity.ipAddress}</p>
          <p><strong>Location:</strong> ${activity.location || 'Unknown'}</p>
          <p><strong>Device:</strong> ${activity.userAgent || 'Unknown'}</p>
        </div>
        
        <p style="margin-top: 20px; font-weight: bold;">
          If this was you, no action is needed. If you don't recognize this activity, please:
        </p>
        
        <ol>
          <li>Change your password immediately</li>
          <li>Review your account for any unauthorized changes</li>
          <li>Enable two-factor authentication if not already enabled</li>
          <li>Contact our support team</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${activity.securitySettingsUrl}" style="background-color: #dc3545; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Review Account Security
          </a>
        </div>
        
        <p>Protecting your account is our priority. If you have any questions or concerns, please contact our support team immediately.</p>
        
        <p>Best regards,<br>M-Pesa Integration Platform Security Team</p>
      </div>
    `;
    
    const text = `
  SECURITY ALERT
  
  Hello ${user.firstName},
  
  We detected unusual activity on your M-Pesa Integration Platform account that you should be aware of:
  
  Activity Details:
  - Time: ${new Date(activity.timestamp).toLocaleString()}
  - Activity: ${activity.description}
  - IP Address: ${activity.ipAddress}
  - Location: ${activity.location || 'Unknown'}
  - Device: ${activity.userAgent || 'Unknown'}
  
  If this was you, no action is needed. If you don't recognize this activity, please:
  
  1. Change your password immediately
  2. Review your account for any unauthorized changes
  3. Enable two-factor authentication if not already enabled
  4. Contact our support team
  
  You can review your account security at:
  ${activity.securitySettingsUrl}
  
  Protecting your account is our priority. If you have any questions or concerns, please contact our support team immediately.
  
  Best regards,
  M-Pesa Integration Platform Security Team
    `;
    
    return { html, text };
  };
  
  module.exports = {
    welcomeEmail,
    passwordResetEmail,
    apiKeyCreatedEmail,
    paymentSuccessSMS,
    securityAlertEmail
  };