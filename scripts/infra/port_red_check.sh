#!/usr/bin/env bash
# =============================================================================
# SCRIPT: port_red_check.sh
# TAREA:  TSK-I1-B01-R — Infra Red-Check
# MISIÓN: Confirmar el estado RED (ausencia de servicios) antes del setup
#         de Docker. Valida que los puertos críticos NO están expuestos.
# =============================================================================

set -euo pipefail

# --- Colores de salida ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# --- Configuración de puertos a auditar ---
APP_PORT=3000
DB_PORT=5432
REDIS_PORT=6379

# --- Contadores ---
PASSED=0
FAILED=0
REPORT_LINES=()

# =============================================================================
# FUNCIÓN: check_port
# Verifica si un puerto está CERRADO (estado RED esperado).
# Returns 0 si el puerto está CERRADO (test PASS), 1 si está ABIERTO (test FAIL).
# =============================================================================
check_port() {
    local host="$1"
    local port="$2"
    local service="$3"
    local check_type="$4"  # "PUBLIC" | "SECURITY"

    # Intento de conexión con timeout vía /dev/tcp
    if (echo >/dev/tcp/"$host"/"$port") 2>/dev/null; then
        PORT_STATUS="OPEN"
    else
        PORT_STATUS="CLOSED"
    fi

    if [[ "$PORT_STATUS" == "CLOSED" ]]; then
        echo -e "  ${GREEN}✔ RED-CHECK PASS${RESET} | ${BOLD}${service}${RESET} (${host}:${port}) — Puerto CERRADO. Estado RED confirmado."
        REPORT_LINES+=("PASS | ${check_type} | ${service} | ${host}:${port} | CERRADO")
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✘ RED-CHECK FAIL${RESET} | ${BOLD}${service}${RESET} (${host}:${port}) — Puerto ABIERTO. Se esperaba ausencia de servicio."
        REPORT_LINES+=("FAIL | ${check_type} | ${service} | ${host}:${port} | ABIERTO")
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# =============================================================================
# FUNCIÓN: security_check
# Comprobación específica de seguridad: los puertos de DB y Redis no deben
# estar accesibles externamente (ni desde localhost en estado pre-Docker).
# =============================================================================
security_check() {
    local host="$1"
    local port="$2"
    local service="$3"

    echo -e "\n  ${BLUE}[SEC]${RESET} Verificando aislamiento externo de ${BOLD}${service}${RESET} en ${host}:${port}..."
    check_port "$host" "$port" "${service} (EXTERNAL)" "SECURITY"
}

# =============================================================================
# HEADER
# =============================================================================
echo ""
echo -e "${BOLD}===============================================================${RESET}"
echo -e "${BOLD}   TSK-I1-B01-R — Infra Red-Check: Validación de Puertos${RESET}"
echo -e "${BOLD}===============================================================${RESET}"
echo -e "  Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
echo -e "  Host      : localhost"
echo -e "  Objetivo  : Confirmar estado RED (sin servicios activos)"
echo ""

# =============================================================================
# BLOQUE 1 — Verificación de Servicios Públicos (Estado RED)
# Confirma que ningún servicio está levantado antes de Docker.
# =============================================================================
echo -e "${BOLD}[ Bloque 1 ] Verificación de Ausencia de Servicios (RED State)${RESET}"
echo -e "  Descripción: Los 3 servicios deben estar CERRADOS antes del setup Docker."
echo ""

check_port "localhost" "$APP_PORT"   "App (Next.js)" "PUBLIC"
check_port "localhost" "$DB_PORT"    "DB (PostgreSQL)" "PUBLIC"
check_port "localhost" "$REDIS_PORT" "Cache (Redis)" "PUBLIC"

# =============================================================================
# BLOQUE 2 — Security Red-Check: Aislamiento Externo DB y Redis
# Valida que 5432 y 6379 deniegan acceso directo desde el exterior (pre-Docker).
# Simula el vector de ataque desde 0.0.0.0 (bind externo).
# =============================================================================
echo ""
echo -e "${BOLD}[ Bloque 2 ] Security Red-Check: Aislamiento DB y Redis${RESET}"
echo -e "  Descripción: Puertos críticos deben denegar acceso externo directo."
echo -e "  ${YELLOW}⚠ Nota:${RESET} Se simulan vectores 127.0.0.1 y 0.0.0.0 para validar la ausencia."
echo ""

security_check "127.0.0.1" "$DB_PORT"    "PostgreSQL (5432)"
security_check "127.0.0.1" "$REDIS_PORT" "Redis (6379)"

# Verificación adicional: bind externo a 0.0.0.0 (si el SO lo permite)
EXTERNAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [[ -n "$EXTERNAL_IP" ]]; then
    echo ""
    echo -e "  ${YELLOW}⚡ Bonus Check:${RESET} Verificando bind en IP externa detectada (${EXTERNAL_IP})..."
    check_port "$EXTERNAL_IP" "$DB_PORT"    "PostgreSQL (5432/ext)" "SECURITY"
    check_port "$EXTERNAL_IP" "$REDIS_PORT" "Redis (6379/ext)"      "SECURITY"
fi

# =============================================================================
# REPORTE FINAL
# =============================================================================
echo ""
echo -e "${BOLD}===============================================================${RESET}"
echo -e "${BOLD}   REPORTE FINAL — TSK-I1-B01-R${RESET}"
echo -e "${BOLD}===============================================================${RESET}"
echo ""
echo -e "  Total Tests : $((PASSED + FAILED))"
echo -e "  ${GREEN}Passed (RED confirmado)${RESET} : $PASSED"
echo -e "  ${RED}Failed (servicio activo)${RESET} : $FAILED"
echo ""

for line in "${REPORT_LINES[@]}"; do
    STATUS=$(echo "$line" | cut -d'|' -f1 | tr -d ' ')
    if [[ "$STATUS" == "PASS" ]]; then
        echo -e "  ${GREEN}[PASS]${RESET} $line"
    else
        echo -e "  ${RED}[FAIL]${RESET} $line"
    fi
done

echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}✔ ESTADO: RED CONFIRMADO${RESET}"
    echo -e "  ${GREEN}Todos los puertos críticos están CERRADOS.${RESET}"
    echo -e "  ${GREEN}Entorno listo para el setup de Docker (TSK-I1-B01-G).${RESET}"
    echo ""
    exit 0
else
    echo -e "  ${RED}${BOLD}✘ ESTADO: SERVICIOS DETECTADOS — REVISAR ANTES DE CONTINUAR${RESET}"
    echo -e "  ${RED}Se detectaron $FAILED puerto(s) activo(s). Detener los servicios antes de ejecutar Docker.${RESET}"
    echo ""
    exit 1
fi
