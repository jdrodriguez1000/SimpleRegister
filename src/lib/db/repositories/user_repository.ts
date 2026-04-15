/**
 * user_repository.ts — Capa de Acceso a Datos: Usuarios y Tokens
 * Trazabilidad: TSK-I2-B01-G1 — Auth Persistence Impl
 * Agente: backend-coder
 */

import { db } from '@/src/lib/db';
import { users, authTokens } from '@/src/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface UserCreate {
  id: string;
  email: string;
  passwordHash: string;
  birthdate: string;
}

export interface TokenCreate {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

/**
 * Puerto de persistencia para usuarios y tokens (Inversión de Dependencias).
 */
export interface UserRepository {
  findByEmail(email: string): Promise<any | null>;
  create(userData: UserCreate, tokenData: TokenCreate): Promise<void>;
  findToken(tokenHash: string): Promise<any | null>;
  useToken(tokenHash: string): Promise<void>;
}

/**
 * Implementación del repositorio usando Drizzle ORM.
 */
export const drizzleUserRepository: UserRepository = {
  async findByEmail(email: string) {
    const result = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0] || null;
  },

  async create(userData: UserCreate, tokenData: TokenCreate) {
    // Usamos una transacción para asegurar atomicidad entre usuario y token
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userData.id,
        email: userData.email,
        password: userData.passwordHash,
        birthdate: userData.birthdate,
        status: 'UNVERIFIED',
      });

      await tx.insert(authTokens).values({
        user_id: userData.id,
        token_hash: tokenData.tokenHash,
        expires_at: new Date(tokenData.expiresAt),
      });
    });
  },

  async findToken(tokenHash: string) {
    const result = await db.select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.token_hash, tokenHash),
          isNull(authTokens.used_at)
        )
      )
      .limit(1);
    
    return result[0] || null;
  },

  async useToken(tokenHash: string) {
    await db.transaction(async (tx) => {
      const token = await tx.select()
        .from(authTokens)
        .where(eq(authTokens.token_hash, tokenHash))
        .limit(1);
      
      if (!token[0]) return;

      // Marcar token como usado (Soft delete)
      await tx.update(authTokens)
        .set({ used_at: new Date() })
        .where(eq(authTokens.token_hash, tokenHash));

      // Activar usuario
      await tx.update(users)
        .set({ status: 'ACTIVE' })
        .where(eq(users.id, token[0].user_id));
    });
  }
};
