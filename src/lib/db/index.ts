import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as usersSchema from './schema/users';
import * as tokensSchema from './schema/auth_tokens';

const schema = { ...usersSchema, ...tokensSchema };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
