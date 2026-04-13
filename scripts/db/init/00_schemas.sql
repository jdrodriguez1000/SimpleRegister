-- =============================================================================
-- 00_schemas.sql — SimpleRegister (Inicialización de Esquemas)
-- Ejecutado automáticamente por PostgreSQL en el primer arranque del contenedor.
-- Arquitectura: Esquema dual (public + audit) con roles diferenciados.
-- =============================================================================

-- Crear esquema de auditoría (logs inmutables)
CREATE SCHEMA IF NOT EXISTS audit;

-- Usuario de la aplicación (permisos restringidos)
-- El usuario se crea con POSTGRES_USER, aquí ajustamos sus permisos.
DO $$
BEGIN
    -- Permisos en esquema public
    GRANT USAGE ON SCHEMA public TO CURRENT_USER;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;

    -- Permisos en esquema audit: solo INSERT (inmutabilidad legal)
    GRANT USAGE ON SCHEMA audit TO CURRENT_USER;
    GRANT INSERT ON ALL TABLES IN SCHEMA audit TO CURRENT_USER;
    -- Sin UPDATE ni DELETE en audit (por diseño — RF4)
END $$;

-- Configuración de permisos por defecto para tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO CURRENT_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit
    GRANT INSERT ON TABLES TO CURRENT_USER;
