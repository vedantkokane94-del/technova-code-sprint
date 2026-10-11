import bcrypt from 'bcryptjs';

const password = process.env.ADMIN_PASSWORD || 'technicalteam@282932';
const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log("Password:", password);
console.log("Bcrypt Hash:", hash);
console.log("Verified:", bcrypt.compareSync(password, hash));
