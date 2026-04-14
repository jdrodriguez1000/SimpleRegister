/**
 * age_validation.ts — Servicio de Validación de Mayoría de Edad
 * Trazabilidad: TSK-I2-B01-G2 — Security & I18N Utils
 * Agente: backend-coder
 *
 * Responsabilidad única: validar que un birthdate YYYY-MM-DD corresponde a una
 * persona mayor de 18 años respecto a una fecha de referencia.
 *
 * Algoritmo Plain-Date (sin conversión a Date/timezone):
 *   - Compara como strings YYYY-MM-DD para evitar drift de zona horaria.
 *   - Maneja el caso bisiesto: nacido el 29-Feb, en año no bisiesto el
 *     cumpleaños cae el 28-Feb.
 *   - Límite mínimo: 1900-01-01 (fechas anteriores son anomalías de datos).
 *
 * RNF3: Validación obligatoria en el servidor. Rechazo inmediato si < 18 años.
 */

// =============================================================================
// Tipos de resultado
// =============================================================================

/**
 * Resultado de la validación de edad.
 * isEligible: true si el usuario tiene 18 o más años.
 * error: código semántico del motivo de rechazo (ausente si isEligible es true).
 */
export interface AgeValidationResult {
  isEligible: boolean;
  error?: 'BIRTHDATE_BEFORE_MIN_DATE' | 'INVALID_DATE_FORMAT' | 'UNDERAGE';
}

// =============================================================================
// Constantes de dominio
// =============================================================================

/** Fecha mínima aceptable — previene datos anómalos o spam con fechas históricas */
const MIN_BIRTHDATE = '1900-01-01';

/** Años requeridos para ser elegible */
const MINIMUM_AGE_YEARS = 18;

// =============================================================================
// Utilidades internas
// =============================================================================

/**
 * Verifica si un año es bisiesto (leap year).
 * Un año es bisiesto si es divisible por 4, excepto los centenarios,
 * que deben ser divisibles por 400.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Dado un año, mes y día de nacimiento, calcula la fecha string YYYY-MM-DD
 * del cumpleaños en ese año objetivo.
 *
 * Caso especial: nacido el 29-Feb — si el año objetivo no es bisiesto,
 * el cumpleaños cae el 28-Feb (convención de la spec).
 */
function birthdayInYear(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  targetYear: number
): string {
  let day = birthDay;

  // Caso bisiesto: nacido el 29 de febrero en año no bisiesto → 28 de febrero
  if (birthMonth === 2 && birthDay === 29 && !isLeapYear(targetYear)) {
    day = 28;
  }

  const mm = String(birthMonth).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Extrae la fecha UTC de una Date como string YYYY-MM-DD.
 * Usa componentes UTC para que no haya drift de zona horaria.
 */
function dateToPlainDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// Lógica pública de validación
// =============================================================================

/**
 * Valida si un birthdate YYYY-MM-DD corresponde a una persona mayor de 18 años
 * respecto a la referenceDate proporcionada.
 *
 * @param birthdate   - Fecha de nacimiento en formato YYYY-MM-DD (string, Plain-Date)
 * @param referenceDate - Fecha de referencia para calcular la edad (usualmente "hoy")
 * @returns AgeValidationResult con isEligible y opcionalmente error
 */
export function validateAge(birthdate: string, referenceDate: Date): AgeValidationResult {
  // ---- Validación de formato básico ----
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(birthdate)) {
    return { isEligible: false, error: 'INVALID_DATE_FORMAT' };
  }

  // ---- Validación de límite mínimo ----
  // Comparación como string YYYY-MM-DD: lexicográficamente correcta para fechas ISO
  if (birthdate < MIN_BIRTHDATE) {
    return { isEligible: false, error: 'BIRTHDATE_BEFORE_MIN_DATE' };
  }

  // ---- Parsear componentes de la fecha de nacimiento ----
  const [birthYearStr, birthMonthStr, birthDayStr] = birthdate.split('-');
  const birthYear = parseInt(birthYearStr, 10);
  const birthMonth = parseInt(birthMonthStr, 10);
  const birthDay = parseInt(birthDayStr, 10);

  // ---- Calcular fecha de referencia como Plain-Date ----
  const referencePlain = dateToPlainDateString(referenceDate);
  const referenceYear = referenceDate.getUTCFullYear();

  // ---- Calcular el año en que el usuario cumple MINIMUM_AGE_YEARS ----
  const targetYear = birthYear + MINIMUM_AGE_YEARS;

  // ---- Obtener la fecha de cumpleaños en el año objetivo ----
  const birthdayAtMinAge = birthdayInYear(birthYear, birthMonth, birthDay, targetYear);

  // ---- Comparación: referenceDate debe ser >= cumpleaños de mayoría de edad ----
  // Si targetYear > referenceYear: el usuario aún no alcanza el año en que cumple 18
  // Si targetYear === referenceYear: comparar el día exacto
  // Si targetYear < referenceYear: ya superó el año de mayoría de edad
  if (referencePlain >= birthdayAtMinAge) {
    return { isEligible: true };
  }

  return { isEligible: false, error: 'UNDERAGE' };
}

/**
 * Shorthand de validación usando la fecha actual como referencia.
 * Conveniente para validaciones en runtime de la API.
 *
 * @param birthdate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns true si el usuario tiene 18 o más años hoy
 */
export function isOver18(birthdate: string): boolean {
  return validateAge(birthdate, new Date()).isEligible;
}
