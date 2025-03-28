const bcrypt = require('bcrypt');
const zxcvbn = require('zxcvbn');

/**
 * Password policy configuration
 */
const passwordPolicy = {
  // Minimum password length
  minLength: 8,
  
  // Maximum password length (to prevent DoS attacks)
  maxLength: 128,
  
  // Require uppercase letters
  requireUppercase: true,
  
  // Require lowercase letters
  requireLowercase: true,
  
  // Require numbers
  requireNumbers: true,
  
  // Require special characters
  requireSpecial: true,
  
  // Minimum zxcvbn strength score (0-4)
  minStrengthScore: 3,
  
  // Prevent common passwords
  preventCommonPasswords: true,
  
  // Prevent password reuse (number of previous passwords to check)
  preventPasswordReuse: 5,
  
  // Password expiry in days (null for no expiry)
  passwordExpiryDays: 90,
  
  // Bcrypt salt rounds
  bcryptSaltRounds: 12
};

/**
 * Validate password against policy
 * @param {string} password - Password to validate
 * @param {Object} userData - Optional user data to check for personal info in password
 * @returns {Object} Validation result
 */
const validatePassword = (password, userData = {}) => {
  const result = {
    valid: true,
    errors: []
  };
  
  // Check length
  if (password.length < passwordPolicy.minLength) {
    result.valid = false;
    result.errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  }
  
  if (password.length > passwordPolicy.maxLength) {
    result.valid = false;
    result.errors.push(`Password cannot exceed ${passwordPolicy.maxLength} characters`);
  }
  
  // Check character requirements
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    result.valid = false;
    result.errors.push('Password must contain at least one uppercase letter');
  }
  
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    result.valid = false;
    result.errors.push('Password must contain at least one lowercase letter');
  }
  
  if (passwordPolicy.requireNumbers && !/[0-9]/.test(password)) {
    result.valid = false;
    result.errors.push('Password must contain at least one number');
  }
  
  if (passwordPolicy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    result.valid = false;
    result.errors.push('Password must contain at least one special character');
  }
  
  // Check password strength using zxcvbn
  if (passwordPolicy.minStrengthScore > 0) {
    // Extract user inputs to avoid using personal info in password
    const userInputs = [];
    if (userData.username) userInputs.push(userData.username);
    if (userData.email) {
      userInputs.push(userData.email);
      const emailParts = userData.email.split('@');
      if (emailParts[0]) userInputs.push(emailParts[0]);
    }
    
    const strengthCheck = zxcvbn(password, userInputs);
    
    if (strengthCheck.score < passwordPolicy.minStrengthScore) {
      result.valid = false;
      result.errors.push('Password is too weak. Please choose a stronger password.');
      
      // Add specific feedback from zxcvbn if available
      if (strengthCheck.feedback.warning) {
        result.errors.push(`Hint: ${strengthCheck.feedback.warning}`);
      }
      
      if (strengthCheck.feedback.suggestions.length > 0) {
        strengthCheck.feedback.suggestions.forEach(suggestion => {
          result.errors.push(`Suggestion: ${suggestion}`);
        });
      }
    }
  }
  
  return result;
};

/**
 * Hash password using bcrypt
 * @param {string} password - Password to hash
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, passwordPolicy.bcryptSaltRounds);
};

/**
 * Verify password against stored hash
 * @param {string} password - Password to verify
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} True if password matches
 */
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Check if password is in the common passwords list
 * @param {string} password - Password to check
 * @returns {boolean} True if password is common
 */
const isCommonPassword = (password) => {
  // Common passwords list (abbreviated for brevity)
  // In a real implementation, you would use a more comprehensive list
  const commonPasswords = [
    'password', 'admin', '123456', 'qwerty', 'welcome',
    'admin123', 'password123', 'abc123', '123456789', 'letmein'
  ];
  
  return commonPasswords.includes(password.toLowerCase());
};

/**
 * Calculate password expiry date
 * @returns {Date|null} Password expiry date or null if no expiry
 */
const calculatePasswordExpiryDate = () => {
  if (!passwordPolicy.passwordExpiryDays) {
    return null;
  }
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + passwordPolicy.passwordExpiryDays);
  return expiryDate;
};

/**
 * Generate a secure random password
 * @param {number} length - Password length
 * @returns {string} Random password
 */
const generateSecurePassword = (length = 16) => {
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numericChars = '0123456789';
  const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  
  const allChars = uppercaseChars + lowercaseChars + numericChars + specialChars;
  
  let password = '';
  
  // Ensure at least one of each character type
  password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
  password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
  password += numericChars.charAt(Math.floor(Math.random() * numericChars.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  
  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  password = password.split('').sort(() => 0.5 - Math.random()).join('');
  
  return password;
};

module.exports = {
  passwordPolicy,
  validatePassword,
  hashPassword,
  verifyPassword,
  isCommonPassword,
  calculatePasswordExpiryDate,
  generateSecurePassword
}; 