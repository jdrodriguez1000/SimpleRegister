/**
 * users.ts — Esquema de base de datos para Drizzle ORM
 * Trazabilidad: TSK-I2-B01-G1 — Auth Persistence Impl
 */

import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

export const userStatusEnum = pgEnum('user_status', ['UNVERIFIED', 'ACTIVE']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  birthdate: varchar('birthdate', { length: 10 }).notNull(), // YYYY-MM-DD
  status: userStatusEnum('status').notNull().default('UNVERIFIED'),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserStatus = 'UNVERIFIED' | 'ACTIVE';
