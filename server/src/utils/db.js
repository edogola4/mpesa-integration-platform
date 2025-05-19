// server/src/utils/db.js

const mongoose = require('mongoose');
const config = require('../config');

/**
 * Connect to MongoDB
 * @returns {Promise} Mongoose connection promise
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;