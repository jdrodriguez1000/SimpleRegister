/**
 * auth_tokens.ts — Esquema de base de datos para Drizzle ORM
 * Trazabilidad: TSK-I2-B01-G1 — Auth Persistence Impl
 */

import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token_hash: varchar('token_hash', { length: 64 }).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuthToken = InferSelectModel<typeof authTokens>;
export type NewAuthToken = InferInsertModel<typeof authTokens>;
