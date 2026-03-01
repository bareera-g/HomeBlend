const { sessions } = require('../store');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

/**
 * Generate a unique 5-character session code.
 */
function generateSessionCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
  } while (sessions.has(code)); // ensure uniqueness
  return code;
}

module.exports = { generateSessionCode };
