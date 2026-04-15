/**
 * password_hash.ts — Hashing de contraseñas mediante Argon2id
 * Trazabilidad: TSK-I2-B01-G2 — Security Utils
 * Agente: backend-coder
 *
 * Responsabilidad única: proporcionar funciones seguras para el hashing
 * de contraseñas utilizando el algoritmo Argon2id (RNF1).
 */

import { hash, verify, argon2id } from 'argon2';

/**
 * Genera un hash seguro utilizando Argon2id.
 * 
 * @param password - Contraseña en texto plano
 * @returns Hash de la contraseña
 */
export async function hashPassword(password: string): Promise<string> {
  // RNF1: Límite de 128 bytes verificado en el servicio (DTO Guard).
  return hash(password, {
    type: argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verifica si una contraseña coincide con un hash.
 * 
 * @param hash - Hash almacenado en DB
 * @param password - Contraseña en texto plano a verificar
 * @returns true si coinciden
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await verify(hashedPassword, password);
  } catch (error) {
    return false;
  }
}
