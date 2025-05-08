// server/src/config/mongoose.js

const mongoose = require('mongoose');
const logger = require('./logger');

// Load environment variables
require('dotenv').config();

// MongoDB connection string
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mpesa_platform';

// Configure Mongoose
mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Exit application on MongoDB disconnect
mongoose.connection.on('disconnected', () => {
  logger.warn('Lost MongoDB connection. Exiting...');
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed due to app termination');
  process.exit(0);
});

module.exports = mongoose;