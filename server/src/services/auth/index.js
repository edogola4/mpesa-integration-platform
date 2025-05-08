/**
 * Export all authentication services
 */
const authService = require('./authService');
const twoFactorService = require('./twoFactorService');
const { RoleService, ROLES, PERMISSIONS } = require('./roleService');
const { TokenService, TOKEN_TYPES } = require('./tokenService');

module.exports = {
  authService,
  twoFactorService,
  RoleService,
  TokenService,
  ROLES,
  PERMISSIONS,
  TOKEN_TYPES,
};