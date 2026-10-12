/**
 * Technova SVIT Code Sprint 2026
 * Admin Password Bcrypt Hash Generator (Cost 12)
 * 
 * Usage:
 *   npm run admin:hash
 *   or:
 *   node scripts/hash-password.js [password]
 */

import readline from 'readline';
import bcrypt from 'bcryptjs';

async function main() {
  let password = process.argv[2] || process.env.NEW_ADMIN_PASSWORD;

  if (!password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    password = await new Promise((resolve) => {
      rl.question('Enter new Admin Password to hash (Bcrypt cost 12): ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!password || password.length < 8) {
    console.error('\n[ERROR] Password must be at least 8 characters long.');
    process.exit(1);
  }

  const saltRounds = 12; // Enforce cost 12
  const hash = bcrypt.hashSync(password, saltRounds);

  console.log('\n=============================================================');
  console.log(' TECHNOVA SVIT: ADMIN BCRYPT HASH GENERATOR (COST 12)');
  console.log('=============================================================');
  console.log('\nBcrypt Hash Generated:');
  console.log(hash);
  console.log('\nSet this in your environment or Vercel Environment Variables:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\nVerification Check:', bcrypt.compareSync(password, hash) ? 'PASSED ✓' : 'FAILED ✗');
  console.log('=============================================================\n');
}

main();
