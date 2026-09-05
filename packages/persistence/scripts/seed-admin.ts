/**
 * Seed script — creates the default admin user and admin_config row.
 *
 * Usage: pnpm db:seed:admin
 *
 * Default admin:
 *   email:    admin@nosoftware.ai
 *   password: nosoftware@1234
 *   role:     admin
 *   mustChangePassword: true (forced on first login)
 *
 * Run this after migrations to bootstrap the admin account.
 */
import { randomUUID } from 'node:crypto';
import { scrypt, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/client.js';
import { users, adminConfig } from '../src/schema/index.js';

const KEY_LENGTH = 64;

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString('hex')}`);
    });
  });
}

async function main() {
  const db = getDb();

  const ADMIN_EMAIL = 'admin@nosoftware.ai';
  const ADMIN_PASSWORD = 'nosoftware@1234';

  // Check if admin already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));

  if (existing) {
    console.log(`✓ Admin user already exists (id: ${existing.id})`);
  } else {
    const adminId = randomUUID();
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    await db.insert(users).values({
      id: adminId,
      email: ADMIN_EMAIL,
      name: 'Admin',
      role: 'admin',
      status: 'active',
      passwordHash,
      mustChangePassword: true,
      credits: '1000', // Bootstrap with 1000 credits
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✓ Admin user created`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  ID:       ${adminId}`);
    console.log(`  Credits:  1000`);
    console.log(`  ⚠ Must change password on first login`);
  }

  // Ensure admin_config exists
  const [configExists] = await db
    .select({ id: adminConfig.id })
    .from(adminConfig);

  if (!configExists) {
    await db.insert(adminConfig).values({
      id: 'default',
      creditsPerUSD: '100',
      minCreditsForBuild: '10',
      platformFeeMultiplier: '1.33',
      updatedAt: new Date(),
    });
    console.log(`✓ Admin config created (100 credits/USD, min 10, fee 1.33x)`);
  } else {
    console.log(`✓ Admin config already exists`);
  }

  console.log('\nDone. Admin can log in at /login');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
