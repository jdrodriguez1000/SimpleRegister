#!/usr/bin/env bash
# =============================================================================
# SCRIPT: setup_env.sh
# TAREA:  TSK-I1-B01-G — Generación automática de .env inicial
# MISIÓN: Copiar .env.example a .env e inyectar un X-Health-Key UUIDv4
#         generado de forma segura. No sobreescribe un .env existente.
# =============================================================================

set -euo pipefail

# --- Colores ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
ENV_FILE="$PROJECT_ROOT/.env"

echo ""
echo -e "${BOLD}===============================================================${RESET}"
echo -e "${BOLD}   Setup Entorno — SimpleRegister${RESET}"
echo -e "${BOLD}===============================================================${RESET}"
echo ""

# --- Verificar que .env.example existe ---
if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo -e "  ${RED}✘ ERROR: No se encontró .env.example en $PROJECT_ROOT${RESET}"
    exit 1
fi

# --- Verificar si .env ya existe (protección de secretos existentes) ---
if [[ -f "$ENV_FILE" ]]; then
    echo -e "  ${YELLOW}⚠ ADVERTENCIA: El archivo .env ya existe.${RESET}"
    echo -e "  No se sobreescribirá para proteger secretos existentes."
    echo -e "  Para regenerar, eliminar manualmente el archivo .env primero."
    echo ""
    exit 0
fi

# --- Generar UUIDv4 de forma segura (múltiples fallbacks) ---
generate_uuid() {
    # Intento 1: Node.js crypto (disponible en el proyecto)
    if command -v node &>/dev/null; then
        node -e "const{randomUUID}=require('crypto');process.stdout.write(randomUUID())" 2>/dev/null && return
    fi
    # Intento 2: Python 3
    if command -v python3 &>/dev/null; then
        python3 -c "import uuid; print(str(uuid.uuid4()), end='')" 2>/dev/null && return
    fi
    # Intento 3: uuidgen (Linux/macOS)
    if command -v uuidgen &>/dev/null; then
        uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '\n' && return
    fi
    # Intento 4: PowerShell (Windows)
    if command -v powershell.exe &>/dev/null; then
        powershell.exe -Command "[System.Guid]::NewGuid().ToString()" 2>/dev/null | tr -d '\r\n' && return
    fi
    # Fallback: /dev/urandom (Linux/WSL)
    if [[ -r /dev/urandom ]]; then
        od -x /dev/urandom | head -1 | awk '{OFS="-"; print $2$3,$4,$5,$6,$7$8$9}' | tr -d '\n' && return
    fi
    echo "NEEDS_MANUAL_UUID_GENERATION"
}

echo -e "  Generando X-Health-Key (UUIDv4)..."
HEALTH_KEY=$(generate_uuid)

# Validar que el UUID generado tiene el formato correcto
UUID_REGEX='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
if [[ ! "$HEALTH_KEY" =~ $UUID_REGEX ]]; then
    echo -e "  ${YELLOW}⚠ No se pudo auto-generar un UUIDv4 válido.${RESET}"
    echo -e "  Se usará el placeholder. Reemplaza 'X_HEALTH_KEY' manualmente en .env."
    HEALTH_KEY="REPLACE_ME_WITH_A_VALID_UUID_V4"
fi

# --- Copiar .env.example a .env ---
cp "$ENV_EXAMPLE" "$ENV_FILE"

# --- Inyectar el UUID generado en .env ---
# Reemplazar el placeholder del setup script con el UUID real
if [[ "$(uname -s)" == "MINGW"* ]] || [[ "$(uname -s)" == "MSYS"* ]]; then
    # Windows/Git Bash: usar sed con backup
    sed -i "s|X_HEALTH_KEY=GENERATED_BY_SETUP_SCRIPT|X_HEALTH_KEY=${HEALTH_KEY}|g" "$ENV_FILE"
else
    # Linux/macOS
    sed -i "" "s|X_HEALTH_KEY=GENERATED_BY_SETUP_SCRIPT|X_HEALTH_KEY=${HEALTH_KEY}|g" "$ENV_FILE" 2>/dev/null || \
    sed -i "s|X_HEALTH_KEY=GENERATED_BY_SETUP_SCRIPT|X_HEALTH_KEY=${HEALTH_KEY}|g" "$ENV_FILE"
fi

echo -e "  ${GREEN}✔ .env creado correctamente.${RESET}"
echo -e "  ${GREEN}✔ X-Health-Key inyectado: ${BOLD}${HEALTH_KEY}${RESET}"
echo ""
echo -e "  ${YELLOW}IMPORTANTE: Revisar y completar las variables marcadas con CHANGE_ME en .env${RESET}"
echo ""
echo -e "  Variables críticas pendientes de configuración:"
echo -e "    - POSTGRES_PASSWORD"
echo -e "    - JWT_SECRET"
echo -e "    - SMTP_PASS"
echo -e "    - CAPTCHA_SECRET_KEY"
echo ""
echo -e "  Siguiente paso: ${BOLD}docker compose up -d db redis${RESET}"
echo ""
