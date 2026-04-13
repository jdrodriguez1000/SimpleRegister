#!/usr/bin/env bash
# =============================================================================
# TEST: connectivity_test.sh
# TAREA: TSK-I1-B01-V — Infra Validation
# MISIÓN: Validar conectividad Container-to-Container (App→DB, App→Redis)
#         y carga correcta de secretos desde el entorno controlado.
# Protocolo: RED-GREEN-VAL — fase VAL
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0
REPORT=()

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Imagen ligera para tests de conectividad (sin construir la app)
TEST_IMAGE="node:20-alpine"
NETWORK="sr_network"

log_pass()  { echo -e "  ${GREEN}✔ PASS${RESET} $1"; REPORT+=("PASS | $1"); PASSED=$((PASSED+1)); }
log_fail()  { echo -e "  ${RED}✘ FAIL${RESET} $1"; REPORT+=("FAIL | $1"); FAILED=$((FAILED+1)); }
log_warn()  { echo -e "  ${YELLOW}⚠ WARN${RESET} $1"; REPORT+=("WARN | $1"); WARNINGS=$((WARNINGS+1)); }

# =============================================================================
# HEADER
# =============================================================================
echo ""
echo -e "${BOLD}===============================================================${RESET}"
echo -e "${BOLD}   TSK-I1-B01-V — Infra Validation: Conectividad y Secretos${RESET}"
echo -e "${BOLD}===============================================================${RESET}"
echo -e "  Timestamp : $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
echo -e "  Red Docker: ${NETWORK}"
echo -e "  Entorno   : Container-to-Container"
echo ""

# =============================================================================
# [PRE] Verificar que los contenedores base están healthy
# =============================================================================
echo -e "${BOLD}[ Pre-Check ] Estado de Contenedores${RESET}"

DB_STATUS=$(docker inspect --format='{{.State.Health.Status}}' sr_db 2>/dev/null || echo "not_found")
REDIS_STATUS=$(docker inspect --format='{{.State.Health.Status}}' sr_redis 2>/dev/null || echo "not_found")

if [[ "$DB_STATUS" == "healthy" ]]; then
    log_pass "sr_db — healthcheck: ${DB_STATUS}"
else
    log_fail "sr_db — healthcheck: ${DB_STATUS} (esperado: healthy)"
fi

if [[ "$REDIS_STATUS" == "healthy" ]]; then
    log_pass "sr_redis — healthcheck: ${REDIS_STATUS}"
else
    log_fail "sr_redis — healthcheck: ${REDIS_STATUS} (esperado: healthy)"
fi

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo -e "  ${RED}Pre-check fallido. Los contenedores base deben estar healthy antes de validar.${RESET}"
    exit 1
fi
echo ""

# =============================================================================
# [TEST 1] Conectividad: Nodo de test → PostgreSQL (TCP + Query)
# Simula el vector de conexión que tendrá la app (dentro de sr_network)
# =============================================================================
echo -e "${BOLD}[ Test 1 ] Conectividad App→DB (PostgreSQL 5432)${RESET}"

source "$PROJECT_ROOT/.env" 2>/dev/null || true

# Test 1.1: TCP — Puerto 5432 alcanzable desde dentro de la red Docker
# Usa Node.js net module (compatible con Alpine sh que no tiene /dev/tcp)
TCP_DB=$(docker run --rm --network "$NETWORK" "$TEST_IMAGE" \
    node -e "const net=require('net');const s=net.createConnection(5432,'db');s.setTimeout(3000);s.on('connect',()=>{process.stdout.write('OPEN');s.destroy();process.exit(0)});s.on('error',()=>{process.stdout.write('CLOSED');process.exit(1)});s.on('timeout',()=>{process.stdout.write('TIMEOUT');process.exit(1)})" \
    2>/dev/null || echo "CLOSED")

if [[ "$TCP_DB" == "OPEN" ]]; then
    log_pass "TCP db:5432 — alcanzable desde red interna"
else
    log_fail "TCP db:5432 — no alcanzable desde red interna (resultado: ${TCP_DB})"
fi

# Test 1.2: Autenticación PostgreSQL — pg_isready desde contenedor externo
PG_READY=$(docker run --rm --network "$NETWORK" postgres:16-alpine \
    pg_isready -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" 2>/dev/null || echo "FAILED")

if echo "$PG_READY" | grep -q "accepting connections"; then
    log_pass "PostgreSQL acepta conexiones (pg_isready -h db -U ${POSTGRES_USER})"
else
    log_fail "PostgreSQL no acepta conexiones: ${PG_READY}"
fi

# Test 1.3: Query real — SELECT version() para confirmar autenticación completa
PG_VERSION=$(docker run --rm --network "$NETWORK" \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    postgres:16-alpine \
    psql -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c "SELECT version();" 2>/dev/null | tr -d '\n ' || echo "FAILED")

if echo "$PG_VERSION" | grep -qi "postgresql"; then
    log_pass "Query SELECT version() exitosa — PostgreSQL autenticado"
else
    log_fail "Query fallida — autenticación PostgreSQL: ${PG_VERSION:0:60}"
fi

# Test 1.4: Verificar esquema 'audit' creado por init script
AUDIT_SCHEMA=$(docker run --rm --network "$NETWORK" \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    postgres:16-alpine \
    psql -h db -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -c \
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name='audit';" 2>/dev/null | tr -d ' \n' || echo "")

if [[ "$AUDIT_SCHEMA" == "audit" ]]; then
    log_pass "Esquema 'audit' existe (dual-schema architecture)"
else
    log_warn "Esquema 'audit' no encontrado — el init script puede no haberse ejecutado aún"
fi

echo ""

# =============================================================================
# [TEST 2] Conectividad: Nodo de test → Redis (TCP + PING)
# =============================================================================
echo -e "${BOLD}[ Test 2 ] Conectividad App→Redis (Redis 6379)${RESET}"

# Test 2.1: TCP — Puerto 6379 alcanzable desde la red interna
# Usa Node.js net module (compatible con Alpine sh que no tiene /dev/tcp)
TCP_REDIS=$(docker run --rm --network "$NETWORK" "$TEST_IMAGE" \
    node -e "const net=require('net');const s=net.createConnection(6379,'redis');s.setTimeout(3000);s.on('connect',()=>{process.stdout.write('OPEN');s.destroy();process.exit(0)});s.on('error',()=>{process.stdout.write('CLOSED');process.exit(1)});s.on('timeout',()=>{process.stdout.write('TIMEOUT');process.exit(1)})" \
    2>/dev/null || echo "CLOSED")

if [[ "$TCP_REDIS" == "OPEN" ]]; then
    log_pass "TCP redis:6379 — alcanzable desde red interna"
else
    log_fail "TCP redis:6379 — no alcanzable desde red interna (resultado: ${TCP_REDIS})"
fi

# Test 2.2: PING/PONG — verificar respuesta de Redis
REDIS_PING=$(docker run --rm --network "$NETWORK" redis:7-alpine \
    redis-cli -h redis ping 2>/dev/null || echo "FAILED")

if [[ "$REDIS_PING" == "PONG" ]]; then
    log_pass "Redis responde PONG al PING"
else
    log_fail "Redis no responde correctamente: ${REDIS_PING}"
fi

# Test 2.3: SET/GET — operaciones de escritura/lectura (simula rate limiting)
REDIS_SET=$(docker run --rm --network "$NETWORK" redis:7-alpine \
    redis-cli -h redis SET sr_test_key "validation_ok" EX 30 2>/dev/null || echo "FAILED")
REDIS_GET=$(docker run --rm --network "$NETWORK" redis:7-alpine \
    redis-cli -h redis GET sr_test_key 2>/dev/null || echo "FAILED")

if [[ "$REDIS_SET" == "OK" && "$REDIS_GET" == "validation_ok" ]]; then
    log_pass "Redis SET/GET exitoso — operaciones de escritura y lectura OK"
    # Limpiar clave de test
    docker run --rm --network "$NETWORK" redis:7-alpine \
        redis-cli -h redis DEL sr_test_key > /dev/null 2>&1
else
    log_fail "Redis SET/GET fallido — SET:${REDIS_SET} | GET:${REDIS_GET}"
fi

# Test 2.4: Configuración maxmemory (según docker-compose.yml)
REDIS_MAXMEM=$(docker run --rm --network "$NETWORK" redis:7-alpine \
    redis-cli -h redis CONFIG GET maxmemory 2>/dev/null | tail -1 || echo "0")

if [[ "$REDIS_MAXMEM" =~ ^[0-9]+$ ]] && [[ "$REDIS_MAXMEM" -gt 0 ]]; then
    MAXMEM_MB=$(( REDIS_MAXMEM / 1024 / 1024 ))
    log_pass "Redis maxmemory configurado: ${MAXMEM_MB}MB (política LRU activa)"
else
    log_warn "Redis maxmemory no detectado: ${REDIS_MAXMEM}"
fi

echo ""

# =============================================================================
# [TEST 3] Aislamiento de Seguridad — Puertos NO expuestos al host
# Confirma que DB y Redis no son accesibles desde el host (fuera de Docker)
# =============================================================================
echo -e "${BOLD}[ Test 3 ] Security Check: Aislamiento de Puertos al Host${RESET}"

# Test 3.1: DB no expuesta al host
DB_EXTERNAL=$(( (echo >/dev/tcp/localhost/5432) 2>/dev/null && echo "OPEN" ) || echo "CLOSED")
if [[ "$DB_EXTERNAL" == "CLOSED" ]]; then
    log_pass "Puerto 5432 NO expuesto al host — DB aislada (Security: PASS)"
else
    log_fail "Puerto 5432 EXPUESTO al host — ¡Violación de seguridad! Verificar docker-compose.yml"
fi

# Test 3.2: Redis no expuesto al host
REDIS_EXTERNAL=$(( (echo >/dev/tcp/localhost/6379) 2>/dev/null && echo "OPEN" ) || echo "CLOSED")
if [[ "$REDIS_EXTERNAL" == "CLOSED" ]]; then
    log_pass "Puerto 6379 NO expuesto al host — Redis aislado (Security: PASS)"
else
    log_fail "Puerto 6379 EXPUESTO al host — ¡Violación de seguridad! Verificar docker-compose.yml"
fi

echo ""

# =============================================================================
# [TEST 4] Validación de Carga de Secretos desde el Entorno Controlado
# =============================================================================
echo -e "${BOLD}[ Test 4 ] Validación de Secretos en Entorno Controlado${RESET}"

# Verificar que las variables críticas están cargadas en los contenedores
DB_ENV_CHECK=$(docker exec sr_db sh -c 'echo "${POSTGRES_DB}:${POSTGRES_USER}"' 2>/dev/null || echo ":")
DB_FROM_ENV="${POSTGRES_DB}:${POSTGRES_USER}"

if [[ "$DB_ENV_CHECK" == "$DB_FROM_ENV" ]]; then
    log_pass "Variables POSTGRES_DB y POSTGRES_USER cargadas correctamente en sr_db"
else
    log_fail "Variables de entorno en sr_db no coinciden: container='${DB_ENV_CHECK}' expected='${DB_FROM_ENV}'"
fi

# Verificar maxmemory policy en Redis (appendonly debe estar activo)
REDIS_APPENDONLY=$(docker exec sr_redis redis-cli CONFIG GET appendonly 2>/dev/null | tail -1 || echo "no")
if [[ "$REDIS_APPENDONLY" == "yes" ]]; then
    log_pass "Redis appendonly=yes — persistencia habilitada"
else
    log_warn "Redis appendonly no confirmado: ${REDIS_APPENDONLY}"
fi

# Verificar X_HEALTH_KEY formato UUID en .env del host
X_KEY=$(grep "^X_HEALTH_KEY=" "$PROJECT_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
UUID_REGEX='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
if [[ "$X_KEY" =~ $UUID_REGEX ]]; then
    log_pass "X_HEALTH_KEY en .env es UUIDv4 válido (Spec Regex: PASS)"
else
    log_fail "X_HEALTH_KEY inválido o ausente: '${X_KEY}'"
fi

# Verificar que JWT_SECRET tiene mínimo 32 chars
JWT=$(grep "^JWT_SECRET=" "$PROJECT_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
if [[ ${#JWT} -ge 32 ]] && [[ "$JWT" != *"CHANGE_ME"* ]]; then
    log_pass "JWT_SECRET configurado con longitud suficiente (≥32 chars)"
elif [[ "$JWT" == *"CHANGE_ME"* ]]; then
    log_warn "JWT_SECRET pendiente de configuración (usa el placeholder CHANGE_ME)"
else
    log_warn "JWT_SECRET tiene longitud insuficiente (${#JWT} chars, mínimo 32)"
fi

echo ""

# =============================================================================
# REPORTE FINAL
# =============================================================================
echo -e "${BOLD}===============================================================${RESET}"
echo -e "${BOLD}   REPORTE FINAL — TSK-I1-B01-V${RESET}"
echo -e "${BOLD}===============================================================${RESET}"
echo ""
echo -e "  Total Tests : $((PASSED + FAILED + WARNINGS))"
echo -e "  ${GREEN}Passed${RESET}   : $PASSED"
echo -e "  ${RED}Failed${RESET}   : $FAILED"
echo -e "  ${YELLOW}Warnings${RESET} : $WARNINGS"
echo ""

for line in "${REPORT[@]}"; do
    STATUS=$(echo "$line" | cut -d'|' -f1 | tr -d ' ')
    case "$STATUS" in
        PASS) echo -e "  ${GREEN}[PASS]${RESET} ${line#PASS | }" ;;
        FAIL) echo -e "  ${RED}[FAIL]${RESET} ${line#FAIL | }" ;;
        WARN) echo -e "  ${YELLOW}[WARN]${RESET} ${line#WARN | }" ;;
    esac
done

echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}✔ VALIDACIÓN EXITOSA — Infraestructura lista para certificación${RESET}"
    echo -e "  ${GREEN}Siguiente tarea: TSK-I1-B01-C (backend-reviewer)${RESET}"
    echo ""
    exit 0
else
    echo -e "  ${RED}${BOLD}✘ VALIDACIÓN FALLIDA — $FAILED test(s) crítico(s) requieren atención${RESET}"
    echo ""
    exit 1
fi
