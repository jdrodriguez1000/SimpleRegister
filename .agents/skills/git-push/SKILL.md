---
name: git-push
description: Sistema de gestión de versiones y sincronización remota basado en el flujo de trabajo de Triple S. Esta habilidad garantiza que el código y la documentación transiten de forma segura desde el entorno local hacia GitHub, respetando la jerarquía de ramas y la trazabilidad de los commits.

---

## 🛤️ I. Política de Ramas (Git Flow)

Este proyecto opera bajo una estructura de **Soberanía de Ramas**:

1.  **Ramas de Estabilidad (`main` / `dev`):** * **Estado:** Solo lectura para el trabajo diario.
    * **Regla:** Prohibido el desarrollo directo. El código solo ingresa vía **Pull Request (PR)** tras pasar la validación de CI y la revisión.
    * **Excepción:** Se permiten pushes directos exclusivamente para correcciones urgentes en `docs/governance/` usando el prefijo `docs:`.

2.  **Ramas de Trabajo (`feat/f[F]_[E]_[nombre]`):**
    * **Nomenclatura:** Basada en la Fase y Etapa (ej: `feat/f1_1.1_setup`).
    * **Vida Útil:** Temporales. Se eliminan tras el merge exitoso en `main`.

---

## ✍️ II. Convenciones de Commits (Semantic Commits)

La comunicación en el historial de Git debe ser técnica y estricta:
- **Idioma:** Español (obligatorio).
- **Formato:** `prefijo: descripción corta en minúsculas`

| Prefijo     | Uso Sugerido                                                 |
| :---------- | :----------------------------------------------------------- |
| `feat:`     | Nueva funcionalidad (asociada a un RF).                      |
| `fix:`      | Corrección de un error o bug.                                |
| `docs:`     | Cambios exclusivos en documentación.                         |
| `refactor:` | Mejora de código que no añade funcionalidad ni corrige bugs. |
| `chore:`    | Tareas de mantenimiento, configuración o dependencias.       |
| `test:`     | Añadir o modificar pruebas (RED/VAL).                        |

---

## 🛠️ III. Gestión de Errores y Resolución Técnica

| Escenario                | Causa Probable                    | Resolución del Protocolo                                            |
| :----------------------- | :-------------------------------- | :------------------------------------------------------------------ |
| `non-fast-forward`       | Remoto más actualizado que local. | `git pull origin [rama] --rebase`. Prohibido el merge commit sucio. |
| `origin already exists`  | Remoto mal configurado.           | Ejecutar `git remote -v` y corregir con `git remote set-url`.       |
| `src refspec matches...` | Rama inexistente localmente.      | Validar ortografía de la rama o realizar `git checkout -b`.         |
| `Permission denied`      | Fallo de SSH/Token.               | Verificar `ssh -T git@github.com` o usar HTTPS con PAT.             |

---

## 🔏 IV. Restricciones Absolutas y Gobernanza

1.  **Anti-Fuerza:** El uso de `git push --force` está vetado. Si es estrictamente necesario, el protocolo lanzará una **ADVERTENCIA ROJA** y requerirá confirmación de que se entiende el riesgo de destruir el historial.
2.  **Limpieza Pre-Push:** Prohibido hacer push si existen archivos en el `staging area` sin commit o cambios sin guardar. El estado debe ser `working tree clean`.
3.  **Ruptura de Protocolo:** Si el usuario solicita saltarse una PR para ir directo a `main`, el sistema registrará una "Infracción de Gobernanza" y pedirá una justificación para el log antes de proceder.

---

## ✅ V. Auditoría de Sincronización (Push Final Check)

- [ ] ¿La rama actual sigue la nomenclatura `feat/f...`?
- [ ] ¿El mensaje del commit describe el "qué" y no el "cómo"?
- [ ] ¿Se ha realizado un `pull --rebase` antes de intentar subir los cambios?
- [ ] ¿La Pull Request (PR) tiene una descripción clara de los RF/RNF afectados?