/**
 * Lightweight validation helpers.
 */

function validateConstraints(c) {
  const errors = [];

  if (!c.rentOrBuy || !['RENT', 'BUY'].includes(c.rentOrBuy)) {
    errors.push('rentOrBuy must be "RENT" or "BUY"');
  }
  if (typeof c.budgetMin !== 'number' || c.budgetMin < 0) {
    errors.push('budgetMin must be a non-negative number');
  }
  if (typeof c.budgetMax !== 'number' || c.budgetMax < 0) {
    errors.push('budgetMax must be a non-negative number');
  }
  if (c.budgetMin != null && c.budgetMax != null && c.budgetMin > c.budgetMax) {
    errors.push('budgetMin must be <= budgetMax');
  }
  if (typeof c.bedsMin !== 'number' || c.bedsMin < 0) {
    errors.push('bedsMin must be a non-negative number');
  }
  if (typeof c.bathsMin !== 'number' || c.bathsMin < 0) {
    errors.push('bathsMin must be a non-negative number');
  }
  if (!c.location || typeof c.location !== 'string') {
    errors.push('location must be a non-empty string');
  }
  if (c.hardNo && !Array.isArray(c.hardNo)) {
    errors.push('hardNo must be an array');
  }

  return errors;
}

module.exports = { validateConstraints };
