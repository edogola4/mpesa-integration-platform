// server/src/config/passport.js
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const User = require('../models/user.model');

// Load environment variables
require('dotenv').config();

const jwtOptions = {
  secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

/**
 * JWT strategy configuration
 * Verifies the token and extracts the user information
 */
const jwtStrategy = new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    // Find the user specified in token
    const user = await User.findById(payload.sub);

    // If user doesn't exist, handle it
    if (!user) {
      return done(null, false);
    }

    // Check if token was issued before the user's password was last changed
    if (payload.iat < user.passwordChangedAt) {
      return done(null, false);
    }

    // Otherwise, return the user
    return done(null, user);
  } catch (error) {
    return done(error, false);
  }
});

module.exports = {
  jwtStrategy,
};