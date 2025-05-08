/**
 * Role-based authorization service
 */
const { AppError } = require('../../utils/errorHandler');
const User = require('../../models/user');
const Business = require('../../models/business');

// Define role hierarchy and permissions
const ROLES = {
  ADMIN: 'admin',
  BUSINESS: 'business',
  DEVELOPER: 'developer',
};

// Define permissions for different resources
const PERMISSIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
};

// Role-based permissions matrix
const rolePermissions = {
  [ROLES.ADMIN]: {
    users: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    businesses: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    transactions: [PERMISSIONS.READ, PERMISSIONS.UPDATE],
    analytics: [PERMISSIONS.READ],
    settings: [PERMISSIONS.READ, PERMISSIONS.UPDATE],
  },
  [ROLES.BUSINESS]: {
    users: [PERMISSIONS.READ], // Can only read their own user
    businesses: [PERMISSIONS.READ, PERMISSIONS.UPDATE], // Can read and update their own business
    transactions: [PERMISSIONS.CREATE, PERMISSIONS.READ],
    analytics: [PERMISSIONS.READ],
    settings: [PERMISSIONS.READ, PERMISSIONS.UPDATE],
  },
  [ROLES.DEVELOPER]: {
    users: [PERMISSIONS.READ], // Can only read their own user
    businesses: [PERMISSIONS.READ], // Can only read businesses they belong to
    transactions: [PERMISSIONS.CREATE, PERMISSIONS.READ],
    analytics: [PERMISSIONS.READ],
    settings: [PERMISSIONS.READ],
  },
};

class RoleService {
  /**
   * Check if a user has a specific permission for a resource
   * @param {Object} user - User object
   * @param {string} resource - Resource type (e.g., 'businesses', 'transactions')
   * @param {string} permission - Permission to check (e.g., 'read', 'create')
   * @param {string} resourceId - Optional ID of the specific resource
   * @returns {Promise<boolean>} Whether the user has the permission
   */
  async hasPermission(user, resource, permission, resourceId = null) {
    if (!user || !user.role) {
      return false;
    }

    // Check if the role has the permission for the resource
    const rolePerms = rolePermissions[user.role];
    if (!rolePerms || !rolePerms[resource] || !rolePerms[resource].includes(permission)) {
      return false;
    }

    // For admin, we don't need to check ownership
    if (user.role === ROLES.ADMIN) {
      return true;
    }

    // For specific resources, check ownership
    if (resourceId) {
      return await this.checkResourceOwnership(user, resource, resourceId);
    }

    return true;
  }

  /**
   * Check if a user owns or has access to a specific resource
   * @param {Object} user - User object
   * @param {string} resource - Resource type
   * @param {string} resourceId - Resource ID
   * @returns {Promise<boolean>} Whether the user owns the resource
   */
  async checkResourceOwnership(user, resource, resourceId) {
    switch (resource) {
      case 'businesses':
        const business = await Business.findById(resourceId);
        return business && business.owner.toString() === user._id.toString();
      
      case 'users':
        // Users can only access their own user data
        return user._id.toString() === resourceId;
      
      case 'transactions':
        // Check if the transaction belongs to a business owned by the user
        const transaction = await Transaction.findById(resourceId).populate('business');
        return (
          transaction && 
          transaction.business && 
          transaction.business.owner.toString() === user._id.toString()
        );
      
      default:
        return false;
    }
  }

  /**
   * Get all permissions for a specific role
   * @param {string} role - Role name
   * @returns {Object} Role permissions
   */
  getRolePermissions(role) {
    return rolePermissions[role] || {};
  }

  /**
   * Check if a user has a specific role
   * @param {Object} user - User object
   * @param {string|Array} roles - Role or array of roles to check
   * @returns {boolean} Whether the user has any of the roles
   */
  hasRole(user, roles) {
    if (!user || !user.role) {
      return false;
    }

    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }

    return user.role === roles;
  }

  /**
   * Assign a role to a user
   * @param {string} userId - User ID
   * @param {string} role - Role to assign
   * @returns {Promise<Object>} Updated user
   */
  async assignRole(userId, role) {
    // Check if role is valid
    if (!Object.values(ROLES).includes(role)) {
      throw new AppError(`Invalid role: ${role}`, 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.role = role;
    await user.save();

    return user;
  }

  /**
   * Get the roles available in the system
   * @returns {Object} Available roles
   */
  getAvailableRoles() {
    return ROLES;
  }
}

module.exports = {
  RoleService: new RoleService(),
  ROLES,
  PERMISSIONS,
};