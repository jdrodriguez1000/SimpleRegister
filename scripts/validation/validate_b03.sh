#!/usr/bin/env bash
# =============================================================================
# validate_b03.sh — TSK-I1-B03-V Resilience Validation
# Agente: backend-tester
# Trazabilidad: PROJECT_spec.md [Rate Limiting, lineas 28-29] + CLAUDE.md [RNF9]
#
# Prerequisito: el contenedor sr_app debe estar UP y HEALTHY en el puerto 3000.
# Uso: bash scripts/validation/validate_b03.sh
#
# Escenarios validados:
#   S1  — Rate Limit activo: 10 req publicas OK, 11ª retorna 429
#   S2  — Headers X-RateLimit-* presentes en respuesta publica
#   S3  — Bypass con X-Health-Key: 11ª req con llave valida retorna 200
#   S4  — Caida de Redis (docker stop): retorna 503 SYSTEM_DEGRADED
#   S5  — Recuperacion tras reinicio de Redis: vuelve a 200
#   S6  — Caida de DB (docker stop): retorna 503 SYSTEM_DEGRADED
#   S7  — Recuperacion tras reinicio de DB: vuelve a 200
# =============================================================================

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1/health}"
# X_HEALTH_KEY debe matchear el valor en .env del contenedor
HEALTH_KEY="${X_HEALTH_KEY:-eef4a41e-8f03-48fb-b985-6e64623be00b}"
CURL_TIMEOUT=10

PASS=0
FAIL=0
SKIP=0

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${NC} — $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗ FAIL${NC} — $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}⚠ SKIP${NC} — $1"; SKIP=$((SKIP + 1)); }
section() { echo -e "\n${YELLOW}═══ $1 ═══${NC}"; }

# Realiza una peticion y retorna el HTTP status code
http_status() {
  local headers=("${@:2}")
  curl -s -o /dev/null -w "%{http_code}" \
    --max-time "$CURL_TIMEOUT" \
    "${headers[@]}" \
    "$1" 2>/dev/null || echo "000"
}

# Realiza una peticion y retorna el body JSON
http_body() {
  local headers=("${@:2}")
  curl -s --max-time "$CURL_TIMEOUT" "${headers[@]}" "$1" 2>/dev/null || echo '{}'
}

# Realiza una peticion y retorna un header especifico
http_header() {
  local header_name="$1"
  local url="$2"
  shift 2
  curl -s -I --max-time "$CURL_TIMEOUT" "$@" "$url" 2>/dev/null \
    | grep -i "^${header_name}:" \
    | awk '{print $2}' \
    | tr -d '\r'
}

# Espera a que el endpoint responda (hasta 60s)
wait_healthy() {
  local max=60
  local elapsed=0
  echo -n "  Esperando que el servicio responda..."
  while [[ $elapsed -lt $max ]]; do
    local code
    code=$(http_status "$BASE_URL" -H "Accept: application/json" -H "X-Forwarded-For: 1.2.3.4")
    if [[ "$code" == "200" || "$code" == "503" ]]; then
      echo " listo (${elapsed}s)"
      return 0
    fi
    sleep 2
    ((elapsed+=2))
    echo -n "."
  done
  echo " TIMEOUT"
  return 1
}

# Espera a que un contenedor vuelva a estar healthy
wait_container_healthy() {
  local container="$1"
  local max=90
  local elapsed=0
  echo -n "  Esperando que $container vuelva a healthy..."
  while [[ $elapsed -lt $max ]]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
    if [[ "$status" == "healthy" ]]; then
      echo " listo (${elapsed}s)"
      return 0
    fi
    sleep 3
    ((elapsed+=3))
    echo -n "."
  done
  echo " TIMEOUT (status: $status)"
  return 1
}

# =============================================================================
# INICIO
# =============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TSK-I1-B03-V — Resilience & Rate Limit Validation          ║"
echo "║  Endpoint: $BASE_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que el endpoint este vivo
echo "▶ Verificando disponibilidad del endpoint..."
if ! wait_healthy; then
  echo -e "${RED}ERROR: El endpoint no responde. Asegurar que sr_app este corriendo.${NC}"
  exit 1
fi

# =============================================================================
# S1 — Rate Limit: 10 peticiones OK, 11ª retorna 429
# Spec: "Rate Limiting: 10 req/min por IP. Algoritmo Fixed Window."
# Usamos IP de prueba fija para aislar este test del trafico real.
# =============================================================================
section "S1 — Fixed Window Rate Limit (IP: 10.10.10.1)"

# Limpiar claves de test en Redis para garantizar ventana limpia (idempotencia)
docker exec sr_redis redis-cli DEL "rate_limit:10.10.10.1" > /dev/null 2>&1 || true
docker exec sr_redis redis-cli DEL "rate_limit:10.10.10.2" > /dev/null 2>&1 || true
docker exec sr_redis redis-cli DEL "rate_limit:10.10.10.3" > /dev/null 2>&1 || true

TEST_IP="10.10.10.1"
ACCEPTED=0
# Enviar 11 peticiones y capturar todos los status codes de una vez
S1_STATUSES=$(for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" --max-time "$CURL_TIMEOUT" \
    -H "Accept: application/json" \
    -H "X-Forwarded-For: $TEST_IP" \
    "$BASE_URL"
done)

ACCEPTED=$(echo "$S1_STATUSES" | head -10 | grep -c "^200$" || echo 0)
S1_LAST=$(echo "$S1_STATUSES" | tail -1 | tr -d '[:space:]')

if [[ $ACCEPTED -eq 10 ]]; then
  pass "Peticiones 1-10 retornan 200 OK ($ACCEPTED/10 aceptadas)"
else
  fail "Solo $ACCEPTED/10 peticiones retornaron 200 OK"
fi

if [[ "$S1_LAST" == "429" ]]; then
  pass "Peticion 11 retorna 429 RATE_LIMIT_EXCEEDED"
else
  fail "Peticion 11 retorno '$S1_LAST' en vez de 429"
fi

# Verificar body del 429 (12ª request, IP aun rate-limited)
BODY_429=$(curl -s --max-time "$CURL_TIMEOUT" \
  -H "Accept: application/json" \
  -H "X-Forwarded-For: $TEST_IP" \
  "$BASE_URL")
ERROR_CODE=$(echo "$BODY_429" | grep -o '"error_code":"[^"]*"' | cut -d'"' -f4)
if [[ "$ERROR_CODE" == "RATE_LIMIT_EXCEEDED" ]]; then
  pass "Body 429 contiene error_code: RATE_LIMIT_EXCEEDED"
else
  fail "Body 429 contiene error_code: '$ERROR_CODE' (esperado: RATE_LIMIT_EXCEEDED)"
fi

# =============================================================================
# S2 — Headers X-RateLimit-* presentes en respuesta publica exitosa
# =============================================================================
section "S2 — Headers X-RateLimit-* (IP: 10.10.10.2)"

TEST_IP_2="10.10.10.2"
RL_LIMIT=$(http_header "X-RateLimit-Limit" "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_2")
RL_REMAINING=$(http_header "X-RateLimit-Remaining" "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_2")
RL_RESET=$(http_header "X-RateLimit-Reset" "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_2")

if [[ "$RL_LIMIT" == "10" ]]; then
  pass "X-RateLimit-Limit: $RL_LIMIT"
else
  fail "X-RateLimit-Limit esperado '10', recibido '$RL_LIMIT'"
fi

if [[ -n "$RL_REMAINING" && "$RL_REMAINING" -ge 0 ]]; then
  pass "X-RateLimit-Remaining presente: $RL_REMAINING"
else
  fail "X-RateLimit-Remaining ausente o invalido: '$RL_REMAINING'"
fi

CURRENT_EPOCH=$(date +%s)
if [[ -n "$RL_RESET" && "$RL_RESET" -gt "$CURRENT_EPOCH" ]]; then
  pass "X-RateLimit-Reset es epoch futuro: $RL_RESET"
else
  fail "X-RateLimit-Reset invalido: '$RL_RESET' (epoch actual: $CURRENT_EPOCH)"
fi

# Retry-After en respuesta 429 — usar GET con dump de headers (no HEAD/curl -I)
# Next.js solo propaga headers custom en GET, no en HEAD implícito de curl -I
RETRY_AFTER=$(curl -s -D - -o /dev/null --max-time "$CURL_TIMEOUT" \
  -H "Accept: application/json" \
  -H "X-Forwarded-For: $TEST_IP" \
  "$BASE_URL" \
  | grep -i "^retry-after:" | awk '{print $2}' | tr -d '[:space:]')
if [[ -n "$RETRY_AFTER" && "$RETRY_AFTER" -gt 0 ]]; then
  pass "Retry-After presente en 429: ${RETRY_AFTER}s"
else
  fail "Retry-After ausente o invalido en 429: '$RETRY_AFTER'"
fi

# =============================================================================
# S3 — Bypass con X-Health-Key valida
# Con la llave correcta, las peticiones NO cuentan contra el rate limit
# =============================================================================
section "S3 — Bypass con X-Health-Key valida (IP: 10.10.10.3)"

TEST_IP_3="10.10.10.3"

# Primero saturar la IP con 10 peticiones SIN llave
for i in $(seq 1 10); do
  http_status "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_3" > /dev/null
done

# Peticion 11 SIN llave: debe retornar 429 (confirma que IP esta rate-limited)
STATUS_NO_KEY=$(http_status "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_3")
if [[ "$STATUS_NO_KEY" == "429" ]]; then
  pass "IP saturada sin llave: peticion 11 retorna 429 (baseline confirmado)"
else
  skip "No se pudo confirmar saturacion de IP (status: $STATUS_NO_KEY)"
fi

# Peticion 11 CON llave valida y MISMA IP: debe retornar 200 (bypass)
STATUS_WITH_KEY=$(http_status "$BASE_URL" \
  -H "X-Forwarded-For: $TEST_IP_3" \
  -H "X-Health-Key: $HEALTH_KEY")
if [[ "$STATUS_WITH_KEY" == "200" ]]; then
  pass "Con X-Health-Key valida: retorna 200 OK aunque IP este rate-limited (bypass)"
else
  fail "Con X-Health-Key valida: retorno $STATUS_WITH_KEY (esperado 200)"
fi

# Con llave valida: no se deben incluir headers X-RateLimit
PRIVATE_RL_LIMIT=$(http_header "X-RateLimit-Limit" "$BASE_URL" \
  -H "X-Forwarded-For: $TEST_IP_3" \
  -H "X-Health-Key: $HEALTH_KEY")
if [[ -z "$PRIVATE_RL_LIMIT" ]]; then
  pass "Modo privado: X-RateLimit-Limit ausente (exento de rate limit)"
else
  fail "Modo privado: X-RateLimit-Limit presente (no deberia estarlo): $PRIVATE_RL_LIMIT"
fi

# =============================================================================
# S4 — Chaos: Caida de Redis
# RNF9 Fail-Closed: Redis caido -> 503 SYSTEM_DEGRADED
# =============================================================================
section "S4 — Chaos Engineering: Caida de Redis (docker stop sr_redis)"

TEST_IP_4="10.10.10.4"

if ! command -v docker &>/dev/null; then
  skip "docker no disponible — omitiendo tests de chaos"
else
  echo "  Deteniendo contenedor sr_redis..."
  docker stop sr_redis > /dev/null 2>&1
  sleep 3  # esperar a que la conexion se propague

  # Peticion publica con Redis caido: debe retornar 503 SYSTEM_DEGRADED
  STATUS_REDIS_DOWN=$(http_status "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_4")
  if [[ "$STATUS_REDIS_DOWN" == "503" ]]; then
    pass "Redis CAIDO — acceso publico retorna 503 SYSTEM_DEGRADED (RNF9 Fail-Closed)"
  else
    fail "Redis CAIDO — retorno $STATUS_REDIS_DOWN (esperado 503)"
  fi

  BODY_REDIS_DOWN=$(http_body "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_4")
  EC_REDIS=$(echo "$BODY_REDIS_DOWN" | grep -o '"error_code":"[^"]*"' | cut -d'"' -f4)
  if [[ "$EC_REDIS" == "SYSTEM_DEGRADED" ]]; then
    pass "Body 503 contiene error_code: SYSTEM_DEGRADED"
  else
    fail "Body 503 contiene error_code: '$EC_REDIS'"
  fi

  # Verificar que redis esta en unhealthy_services
  if echo "$BODY_REDIS_DOWN" | grep -q '"redis"'; then
    pass "Body 503 lista 'redis' en unhealthy_services"
  else
    fail "Body 503 NO lista 'redis' en unhealthy_services"
  fi

  # =============================================================================
  # S5 — Recuperacion tras reinicio de Redis
  # =============================================================================
  section "S5 — Recuperacion tras reinicio de Redis"

  echo "  Reiniciando contenedor sr_redis..."
  docker start sr_redis > /dev/null 2>&1
  wait_container_healthy "sr_redis"
  sleep 3  # dar tiempo al health check de Next.js

  STATUS_REDIS_UP=$(http_status "$BASE_URL" \
    -H "X-Forwarded-For: $TEST_IP_4" \
    -H "Accept: application/json")
  if [[ "$STATUS_REDIS_UP" == "200" ]]; then
    pass "Tras reinicio de Redis: retorna 200 OK (recuperacion confirmada)"
  else
    fail "Tras reinicio de Redis: retorno $STATUS_REDIS_UP (esperado 200)"
  fi
fi

# =============================================================================
# S6 — Chaos: Caida de DB
# DB caida -> 503 SYSTEM_DEGRADED (rate limit aun funciona con Redis UP)
# =============================================================================
section "S6 — Chaos Engineering: Caida de DB (docker stop sr_db)"

TEST_IP_6="10.10.10.6"

if ! command -v docker &>/dev/null; then
  skip "docker no disponible — omitiendo tests de chaos"
else
  echo "  Deteniendo contenedor sr_db..."
  docker stop sr_db > /dev/null 2>&1
  sleep 5  # DB tarda mas en propagar la desconexion

  STATUS_DB_DOWN=$(http_status "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_6")
  if [[ "$STATUS_DB_DOWN" == "503" ]]; then
    pass "DB CAIDA — retorna 503 SYSTEM_DEGRADED"
  else
    fail "DB CAIDA — retorno $STATUS_DB_DOWN (esperado 503)"
  fi

  BODY_DB_DOWN=$(http_body "$BASE_URL" -H "X-Forwarded-For: $TEST_IP_6")
  EC_DB=$(echo "$BODY_DB_DOWN" | grep -o '"error_code":"[^"]*"' | cut -d'"' -f4)
  if [[ "$EC_DB" == "SYSTEM_DEGRADED" ]]; then
    pass "Body 503 contiene error_code: SYSTEM_DEGRADED"
  else
    fail "Body 503 contiene error_code: '$EC_DB'"
  fi

  if echo "$BODY_DB_DOWN" | grep -q '"database"'; then
    pass "Body 503 lista 'database' en unhealthy_services"
  else
    fail "Body 503 NO lista 'database' en unhealthy_services"
  fi

  # Verificar que version y timestamp estan presentes (RNF5: siempre JSON valido)
  HAS_VERSION=$(echo "$BODY_DB_DOWN" | grep -c '"version":"1.0.0"' || true)
  HAS_TIMESTAMP=$(echo "$BODY_DB_DOWN" | grep -c '"timestamp":' || true)
  if [[ $HAS_VERSION -gt 0 && $HAS_TIMESTAMP -gt 0 ]]; then
    pass "Body 503 incluye version y timestamp (sistema responde sin DB — RNF5)"
  else
    fail "Body 503 no incluye version/timestamp: $BODY_DB_DOWN"
  fi

  # =============================================================================
  # S7 — Recuperacion tras reinicio de DB
  # =============================================================================
  section "S7 — Recuperacion tras reinicio de DB"

  echo "  Reiniciando contenedor sr_db..."
  docker start sr_db > /dev/null 2>&1
  wait_container_healthy "sr_db"
  sleep 5  # dar tiempo al pool de conexiones de PG

  STATUS_DB_UP=$(http_status "$BASE_URL" \
    -H "X-Forwarded-For: $TEST_IP_6" \
    -H "Accept: application/json")
  if [[ "$STATUS_DB_UP" == "200" ]]; then
    pass "Tras reinicio de DB: retorna 200 OK (recuperacion confirmada)"
  else
    fail "Tras reinicio de DB: retorno $STATUS_DB_UP (esperado 200)"
  fi
fi

# =============================================================================
# RESUMEN
# =============================================================================
TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  RESULTADO DE VALIDACION TSK-I1-B03-V                       ║"
printf "║  %-60s ║\n" "Total: $TOTAL checks | Pass: $PASS | Fail: $FAIL | Skip: $SKIP"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}VALIDACION EXITOSA — DoD de TSK-I1-B03-V CUMPLIDO${NC}"
  exit 0
else
  echo -e "${RED}VALIDACION FALLIDA — $FAIL checks no superados${NC}"
  exit 1
fi
