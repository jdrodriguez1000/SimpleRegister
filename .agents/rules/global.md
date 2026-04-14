---
trigger: always_on
---

# Global Agent Rules (AntiGravity)

## 1. Contexto de Interoperabilidad Híbrida
Este repositorio es un entorno de trabajo compartido entre **Google AntiGravity** y **Claude Code**. Para garantizar la consistencia del código y la armonía entre agentes, estas reglas son de cumplimiento obligatorio para todo agente de IA que opere en este espacio.

## 2. Directorio Maestro de Agentes
* **Ubicación de Inteligencia:** El núcleo de configuración de agentes reside en la carpeta `.claude/agents`.
* **Definiciones de Agentes:** Todas las personalidades, protocolos de comunicación y habilidades específicas están documentadas en archivos `.md` dentro de `.claude/agents`.
* **Sincronización:** Los agentes de AntiGravity deben tratar esta carpeta como su fuente de verdad primaria para definir su comportamiento y toma de decisiones.

## 3. Jerarquía y Reglas de Oro
1. **Prioridad Técnica (CLAUDE.md):** Antes de realizar cambios en la estructura de archivos, ejecutar comandos de consola (build, test, deploy) o aplicar estilos de código, el agente **DEBE** leer el archivo `CLAUDE.md` en la raíz.
2. **Sincronización de Contexto:** Las reglas técnicas definidas en `CLAUDE.md` tienen precedencia absoluta sobre las suposiciones generales del modelo.
3. **Colaboración (AGENTS.md):** Para entender el flujo de trabajo entre IAs, la asignación de responsabilidades y el estado actual del proyecto, se debe consultar el archivo `AGENTS.md` en la raíz.

## 4. Flujo de Trabajo Obligatorio
* **Validación Previa:** Antes de proponer una refactorización o realizar un commit, el agente debe verificar que la acción cumple con los estándares de `./agents` y los protocolos de `CLAUDE.md`.
* **Resolución de Conflictos:** Si existe discrepancia entre las instrucciones nativas de AntiGravity y lo definido en `CLAUDE.md`, el agente debe informar al usuario y priorizar la configuración local del proyecto.
* **Mantenimiento:** Cualquier actualización en la lógica de operación o nuevas habilidades adquiridas debe ser documentada en el archivo correspondiente dentro de `.claude/agents`.