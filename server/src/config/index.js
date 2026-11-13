require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-here',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-here',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
};

if (module.exports.jwtSecret === 'your-jwt-secret-here' && module.exports.nodeEnv === 'production') {
  console.warn('WARNING: JWT_SECRET is using the default value. Set a strong secret in production.');
}
