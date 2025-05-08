// server/src/services/transactions/transactionScheduler.js

const Transaction = require('../../models/transaction');
const MpesaServiceFactory = require('../mpesa/mpesaServiceFactory');
const logger = require('../../utils/logger');

/**
 * Service for scheduling and executing transaction-related tasks
 */
class TransactionScheduler {
  /**
   * Initialize the scheduler
   */
  init() {
    logger.info('Initializing transaction scheduler');
    
    // Schedule periodic checks for pending transactions
    this._schedulePendingTransactionChecks();
    
    // Schedule cleanup for expired transactions
    this._scheduleExpiredTransactionCleanup();
    
    // Schedule retry for failed transactions that can be retried
    this._scheduleFailedTransactionRetry();
  }
  
  /**
   * Schedule periodic checks for pending transactions
   * 
   * @private
   */
  _schedulePendingTransactionChecks() {
    // Run every 5 minutes
    const intervalMs = 5 * 60 * 1000;
    
    setInterval(async () => {
      logger.info('Running pending transaction check');
      
      try {
        await this._checkPendingTransactions();
      } catch (error) {
        logger.error('Error checking pending transactions', { error });
      }
    }, intervalMs);
  }
  
  /**
   * Schedule cleanup for expired transactions
   * 
   * @private
   */
  _scheduleExpiredTransactionCleanup() {
    // Run every hour
    const intervalMs = 60 * 60 * 1000;
    
    setInterval(async () => {
      logger.info('Running expired transaction cleanup');
      
      try {
        await this._cleanupExpiredTransactions();
      } catch (error) {
        logger.error('Error cleaning up expired transactions', { error });
      }
    }, intervalMs);
  }
  
  /**
   * Schedule retry for failed transactions
   * 
   * @private
   */
  _scheduleFailedTransactionRetry() {
    // Run every 15 minutes
    const intervalMs = 15 * 60 * 1000;
    
    setInterval(async () => {
      logger.info('Running failed transaction retry');
      
      try {
        await this._retryFailedTransactions();
      } catch (error) {
        logger.error('Error retrying failed transactions', { error });
      }
    }, intervalMs);
  }
  
  /**
   * Check pending transactions to update their status
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _checkPendingTransactions() {
    // Find pending transactions that haven't been updated in the last 5 minutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 5);
    
    const pendingTransactions = await Transaction.find({
      status: 'pending',
      updatedAt: { $lt: cutoffTime }
    }).limit(100); // Process in batches to avoid overload
    
    logger.info(`Found ${pendingTransactions.length} pending transactions to check`);
    
    // Process each transaction
    for (const transaction of pendingTransactions) {
      try {
        const mpesaService = MpesaServiceFactory.getService(transaction.country);
        
        // Skip if no M-Pesa reference (shouldn't happen but just in case)
        if (!transaction.mpesaReference) {
          logger.warn(`Pending transaction ${transaction._id} has no M-Pesa reference`);
          continue;
        }
        
        // Check status with M-Pesa
        const statusResponse = await mpesaService.checkTransactionStatus(
          transaction.mpesaReference
        );
        
        // Determine new status based on the response
        let newStatus = transaction.status;
        
        // Different countries have different status formats
        switch (transaction.country.toLowerCase()) {
          case 'kenya':
            if (statusResponse.ResultCode === '0') {
              newStatus = 'completed';
            } else if (statusResponse.ResultCode === '1') {
              newStatus = 'failed';
            }
            break;
            
          // Add other countries as implemented
            
          default:
            // Generic handling
            if (statusResponse.status === 'success') {
              newStatus = 'completed';
            } else if (statusResponse.status === 'failed') {
              newStatus = 'failed';
            }
        }
        
        // Update transaction if status changed
        if (newStatus !== transaction.status) {
          transaction.status = newStatus;
          transaction.statusHistory.push({
            status: newStatus,
            metadata: { statusResponse }
          });
          
          await transaction.save();
          
          logger.info(`Updated transaction ${transaction._id} status to ${newStatus}`);
        }
      } catch (error) {
        logger.error(`Error checking transaction ${transaction._id}`, { error });
      }
    }
  }
  
  /**
   * Clean up expired transactions
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _cleanupExpiredTransactions() {
    // Find initiated transactions that are older than 30 minutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 30);
    
    const expiredTransactions = await Transaction.find({
      status: 'initiated',
      createdAt: { $lt: cutoffTime }
    }).limit(100);
    
    logger.info(`Found ${expiredTransactions.length} expired transactions to clean up`);
    
    // Mark each as expired
    for (const transaction of expiredTransactions) {
      try {
        transaction.status = 'expired';
        transaction.statusHistory.push({
          status: 'expired',
          metadata: { reason: 'Transaction timed out' }
        });
        
        await transaction.save();
        
        logger.info(`Marked transaction ${transaction._id} as expired`);
      } catch (error) {
        logger.error(`Error expiring transaction ${transaction._id}`, { error });
      }
    }
  }
  
  /**
   * Retry failed transactions that may have failed due to temporary issues
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _retryFailedTransactions() {
    // Find failed transactions that have a retry flag and haven't been retried too many times
    const failedTransactions = await Transaction.find({
      status: 'failed',
      'metadata.canRetry': true,
      'metadata.retryCount': { $lt: 3 } // Maximum 3 retries
    }).limit(50);
    
    logger.info(`Found ${failedTransactions.length} failed transactions to retry`);
    
    // Retry each transaction
    for (const transaction of failedTransactions) {
      try {
        const mpesaService = MpesaServiceFactory.getService(transaction.country);
        
        // Increment retry count
        if (!transaction.metadata.retryCount) {
          transaction.metadata.retryCount = 1;
        } else {
          transaction.metadata.retryCount += 1;
        }
        
        // Change status to retry
        transaction.status = 'retry';
        transaction.statusHistory.push({
          status: 'retry',
          metadata: { retryCount: transaction.metadata.retryCount }
        });
        
        await transaction.save();
        
        // Initiate a new payment
        const paymentResponse = await mpesaService.initiatePayment({
          phoneNumber: transaction.phoneNumber,
          amount: transaction.amount,
          reference: transaction._id.toString(), // Use the same transaction ID
          description: transaction.requestPayload.description,
          callbackUrl: `${process.env.API_BASE_URL}/api/webhooks/mpesa/${transaction._id}`
        });
        
        // Update transaction with new M-Pesa reference
        transaction.mpesaReference = paymentResponse.transactionId;
        transaction.status = 'pending';
        transaction.statusHistory.push({
          status: 'pending',
          metadata: { mpesaReference: transaction.mpesaReference }
        });
        
        await transaction.save();
        
        logger.info(`Retried transaction ${transaction._id}, new status: pending`);
      } catch (error) {
        logger.error(`Error retrying transaction ${transaction._id}`, { error });
        
        // Update to indicate retry failed
        try {
          transaction.statusHistory.push({
            status: 'retry_failed',
            metadata: { error: error.message }
          });
          await transaction.save();
        } catch (saveError) {
          logger.error(`Error updating retry status for ${transaction._id}`, { saveError });
        }
      }
    }
  }
}

module.exports = new TransactionScheduler();