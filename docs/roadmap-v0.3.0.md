# 🗺️ Roadmap — Dacmos Password Manager v0.3.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**  
**Documento generado:** Abril 2026  
**Versión base:** 0.2.0 (en revisión Chrome Web Store)  
**Versión objetivo:** 0.3.0

---

## Contexto estratégico

Dacmos Password Manager v0.2.0 alcanzó paridad competitiva mínima con
gestores gratuitos como Bitwarden y Proton Pass. La v0.3.0 introduce
sincronización multi-dispositivo con arquitectura **BYOC (Bring Your Own
Cloud)** — el usuario elige dónde vive su vault cifrado.

**Diferenciador clave vs. competencia:**
- Bitwarden: requiere su propio servidor o el de Bitwarden (vendor lock-in)
- Proton Pass: solo Proton Cloud
- Dacmos v0.3.0: Google Drive, OneDrive, o cualquier proveedor futuro

El vault sigue siendo un blob AES-256-GCM opaco — el proveedor cloud
nunca ve los datos en claro. Zero-Knowledge se mantiene intacto.

Referencia de análisis competitivo: `docs/Analisis-Competitivo.md`

---

## Principios que NO cambian en v0.3.0

- Zero-Knowledge local-first — los datos nunca salen sin la clave del usuario
- Sin dependencias de crypto externas — Web Crypto API nativa únicamente
- Manifest V3 — sin regresión a V2
- Código comentado en español
- Sin librerías de terceros innecesarias
- engine.js no se toca

---

## Arquitectura BYOC — Diseño central

### StorageAdapter Interface

Todos los adaptadores de sincronización implementan la misma interfaz:

```javascript
// src/sync/storage-adapter.js
// Interfaz base que todos los adaptadores deben implementar

export class StorageAdapter {
  // Guarda el vault cifrado en el proveedor
  async guardar(vaultCifrado) { throw new Error('No implementado') }

  // Carga el vault cifrado desde el proveedor
  async cargar() { throw new Error('No implementado') }

  // Retorna la fecha de última modificación en el proveedor
  async ultimaModificacion() { throw new Error('No implementado') }

  // Verifica si hay conectividad con el proveedor
  async verificarConexion() { throw new Error('No implementado') }

  // Nombre del proveedor para mostrar en UI
  nombreProveedor() { throw new Error('No implementado') }
}
```

### Adaptadores a implementar en v0.3.0

```
src/sync/
├── storage-adapter.js      ← Interfaz base
├── google-drive-adapter.js ← Prioritario (mayor penetración LATAM)
├── onedrive-adapter.js     ← Segundo proveedor
└── sync-manager.js         ← Orquestador: detecta conflictos, merge
```

### Flujo de sincronización

```
[Usuario activa sync en Settings]
        │
        ▼
[Selector de proveedor: Google Drive / OneDrive]
        │
        ▼
[OAuth del proveedor (chrome.identity)]
        │
        ▼
[sync-manager.js verifica última modificación]
        │
        ├── Local más reciente → subir vault cifrado
        ├── Remoto más reciente → descargar y fusionar
        └── Mismo timestamp → no hacer nada
        │
        ▼
[Indicador de estado en popup: ✅ Sincronizado / ⚠️ Pendiente]
```

### Resolución de conflictos

Estrategia: **Last Write Wins por timestamp** con respaldo automático.

```
Si hay conflicto (ambos modificados desde última sync):
  1. Descargar versión remota como backup
  2. Fusionar por ID de credencial (union de ambos arrays)
  3. En duplicados por ID: conservar el más reciente por modificado
  4. Subir versión fusionada
  5. Notificar al usuario: "X credenciales sincronizadas"
```

---

## Features de v0.3.0

### F2.1 — Google Drive Sync

**Prioridad:** CRÍTICA — mayor penetración en LATAM  
**Motivación:** Casi todo usuario latinoamericano tiene cuenta Google.
Storage gratuito (15 GB) más que suficiente para vault (~50 KB).

**Alcance:**
- Autenticación OAuth con cuenta Google (chrome.identity)
- Almacenamiento del vault cifrado como archivo en Google Drive
  (carpeta oculta de la app — no visible en Drive del usuario)
- Sincronización automática al desbloquear y al guardar cambios
- Indicador de estado de sync en el popup
- Opción de sync manual desde Settings

**Seguridad:**
- Google nunca recibe la clave de descifrado
- El archivo en Drive es opaco: bytes cifrados AES-256-GCM
- OAuth scope mínimo: `drive.appdata` (carpeta privada de la app)
  Google no puede listar ni leer el archivo desde su UI

**Costo para el usuario:** $0 (usa su cuenta Google existente)
**Costo para DacmosGroup:** $0 (registro de app en Google Cloud gratuito)

---

### F2.2 — OneDrive Sync

**Prioridad:** ALTA — segundo proveedor  
**Motivación:** Usuarios con cuenta Microsoft (Outlook, Xbox, Office).
Microsoft Graph API es bien documentada y similar a Google Drive API.

**Alcance:**
- Autenticación OAuth con cuenta Microsoft (chrome.identity)
- Almacenamiento en OneDrive via Microsoft Graph API
- Misma lógica de sync que F2.1
- Selector de proveedor en Settings

**Costo para el usuario:** $0 (5 GB gratuitos en OneDrive)
**Costo para DacmosGroup:** $0 (registro de app en Azure AD gratuito)

---

### F2.3 — Selector de proveedor en Settings

**Prioridad:** ALTA — UX del sistema BYOC  
**Motivación:** El usuario debe poder elegir y cambiar de proveedor.

**Alcance:**
- Nueva sección "Sincronización" en Settings
- Cards visuales por proveedor con estado (conectado/desconectado)
- Botón de desconectar (revoca OAuth sin borrar datos locales)
- Opción de migrar entre proveedores (descarga de uno, sube al otro)
- Historial de última sincronización con timestamp

**UI propuesta:**
```
┌─────────────────────────────────────────┐
│ 🔄 Sincronización multi-dispositivo     │
├─────────────────────────────────────────┤
│ [Google Drive ✅]  Conectado            │
│ Última sync: hace 2 minutos             │
│ [Sincronizar ahora] [Desconectar]       │
├─────────────────────────────────────────┤
│ [OneDrive ⬜]  No conectado             │
│ [Conectar con Microsoft]               │
└─────────────────────────────────────────┘
```

---

### F2.4 — Indicador de estado en popup

**Prioridad:** MEDIA  
**Motivación:** El usuario debe saber en todo momento si su vault
está sincronizado sin abrir Settings.

**Alcance:**
- Ícono de estado en el popup: ✅ Sincronizado / 🔄 Sincronizando /
  ⚠️ Pendiente / ❌ Error de conexión
- Tooltip con detalle del estado al hacer hover
- Badge de notificación si hay sync pendiente por más de 1 hora

---

## Lo que NO cambia en v0.3.0

- engine.js — intacto
- manifest.json — solo bump de versión a 0.3.0
- Todos los features de v0.2.0 — sin regresión
- El vault local sigue siendo la fuente de verdad principal
- Sin servidor propio de DacmosGroup (todo en cuenta del usuario)

---

## Implicaciones de costos

| Concepto | Costo |
|---|---|
| Google Cloud Console (registro de app) | $0 |
| Azure Active Directory (registro de app) | $0 |
| Almacenamiento en Drive/OneDrive del usuario | $0 |
| Infraestructura DacmosGroup | $0 |
| **Total mensual para DacmosGroup** | **$0** |

El modelo BYOC elimina completamente los costos de infraestructura
antes de la monetización en v0.5.0.

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6) — en revisión Chrome Web Store
v0.3.0 🔄  Sync BYOC — Google Drive + OneDrive
v0.4.0 ⏳  App móvil React Native (iOS + Android) con sync nativo
v0.5.0 ⏳  Tier Premium $1-1.50/mes + Plan Familias
v1.0.0 ⏳  Auditoría Cure53 + listado público Chrome Web Store
```

---

## Brief para Claude Code — v0.3.0

```
Proyecto: Dacmos Password Manager
Repo: [ruta local]
Branch de trabajo: crear rama feature/v0.3.0 desde main
Documentos de referencia: docs/documento-tecnico.md, docs/roadmap-v0.3.0.md

Estamos desarrollando la v0.3.0. Los principios de seguridad son
no negociables (ver documento-tecnico.md). El roadmap completo
está en docs/roadmap-v0.3.0.md.

Antes de iniciar cualquier desarrollo:
1. Lee docs/documento-tecnico.md completo
2. Lee docs/roadmap-v0.3.0.md completo
3. Confirma qué ítem vamos a desarrollar en esta sesión
4. Propón la arquitectura antes de escribir código
5. Espera mi aprobación antes de proceder

Ítem a desarrollar en esta sesión: [ESPECIFICAR]
```

---

## Criterios de completitud para v0.3.0

- [ ] F2.1 — Google Drive sync con OAuth y resolución de conflictos
- [ ] F2.2 — OneDrive sync con Microsoft Graph API
- [ ] F2.3 — Selector de proveedor en Settings con UI BYOC
- [ ] F2.4 — Indicador de estado en popup
- [ ] Documentación actualizada
- [ ] Versión bumpeada a 0.3.0 en manifest.json
- [ ] PR mergeado a main con descripción completa

---

## Notas para contenido educativo DacmosGroup

| Feature | Tema de contenido | Audiencia |
|---|---|---|
| BYOC sync | "Qué es BYOC y por qué importa tu privacidad" | No técnica |
| Google Drive adapter | "Cómo sincronizar contraseñas sin que Google las vea" | No técnica |
| OAuth scope drive.appdata | "Por qué pedimos acceso limitado a tu Drive" | Técnica |
| StorageAdapter pattern | "Arquitectura de plugins en JavaScript moderno" | Técnica |
| Conflict resolution | "Cómo sincronizar sin perder datos" | Técnica |

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
