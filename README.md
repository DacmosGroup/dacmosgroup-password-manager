# 🔐 Dacmos Password Manager

**Gestor de contraseñas Zero-Knowledge local-first — Chrome Extension + PWA Mobile · construido en público por [DacmosGroup.co](https://dacmosgroup.co)**

> Este proyecto es simultáneamente una herramienta funcional y contenido educativo
> sobre seguridad de la información aplicada.

[![Estado](https://img.shields.io/badge/Estado-Publicado-green)](https://dacmosgroup.co)
[![Extension](https://img.shields.io/badge/Extension-v0.4.1-blue)](https://github.com/DacmosGroup/dacmosgroup-password-manager)
[![PWA](https://img.shields.io/badge/PWA-v0.4.3-green)](https://dpm.dacmosgroup.co)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow)](./LICENSE)

---

## 🛡️ Modelo de Seguridad

| Componente          | Estándar                                                |
|---------------------|---------------------------------------------------------|
| Cifrado             | AES-256-GCM (NIST FIPS 197)                             |
| Derivación de clave | PBKDF2-SHA256, 600,000 iteraciones (OWASP 2024)         |
| Almacenamiento      | chrome.storage.local / IndexedDB (cifrado local)        |
| Modelo              | Zero-Knowledge — tus datos nunca salen del dispositivo  |
| Cripto engine       | Web Crypto API nativa — sin librerías de terceros       |

---

## 📋 Estado del Proyecto

### ✅ Fase 1 — Chrome Extension MVP (COMPLETADA)

| Entregable | Descripción | Estado |
|-----------|-------------|--------|
| E1.1 | Repositorio GitHub configurado | ✅ |
| E1.2 | UI base — popup, vault, settings | ✅ |
| E1.3 | Motor de cifrado AES-256-GCM + PBKDF2 | ✅ |
| E1.4 | Gestión completa de Master Password | ✅ |
| E1.5 | CRUD de credenciales cifradas | ✅ |
| E1.6 | Generador de contraseñas con entropía | ✅ |
| E1.7 | Autodetección de campos de login | ✅ |
| E1.8 | Autocompletado con Zero-Knowledge | ✅ |
| E1.9 | Lock automático por inactividad + badge | ✅ |
| E1.10 | Export/Import vault cifrado | ✅ |

### ✅ Fase 1.5 — Paridad competitiva v0.2.0 (COMPLETADA)

| Feature | Descripción | Estado |
|---------|-------------|--------|
| F1.1 | Importar CSV desde Google PM, Bitwarden, LastPass, 1Password | ✅ |
| F1.2 | Generador TOTP integrado (RFC 6238) con cuenta regresiva | ✅ |
| F1.3 | Password Health Reports + HIBP k-anonymity | ✅ |
| F1.4 | Exportar en CSV genérico y CSV Bitwarden | ✅ |
| F1.5 | Tipos de credencial: Tarjeta de crédito e Identidad | ✅ |
| F1.6 | URL matching mejorado con dominio base y wildcards | ✅ |

### ✅ Fase 2 — Sincronización BYOC v0.3.0 (COMPLETADA)

| Feature | Descripción | Estado |
|---------|-------------|--------|
| F2.1 | Google Drive Sync — OAuth drive.appdata, Zero-Knowledge | ✅ |
| F2.2 | OneDrive Sync — Microsoft Graph API, Zero-Knowledge | ✅ |
| F2.3 | Selector de proveedor en Settings — cards Google Drive / OneDrive | ✅ |
| F2.4 | Indicador de estado en popup — Sincronizado / Pendiente / Error | ✅ |

### ✅ Fase 2.5 — UX Polish v0.3.1 (COMPLETADA)

| Feature | Descripción | Estado |
|---------|-------------|--------|
| F3.1 | Botón ← Inicio consistente en todas las vistas de pestaña completa | ✅ |
| F3.3 | Legibilidad mejorada en cards del vault (TOTP, timestamps, textos) | ✅ |
| F3.4 | Versión dinámica en Settings — leída desde manifest.json | ✅ |
| F3.5 | Fix autocompletado en formularios Create/Confirm password | ✅ |

### ✅ Fase 3 — PWA Mobile v0.4.0 + Remediación v0.4.1 + Auditoría v0.4.2 (COMPLETADA)

| Feature | Descripción | Estado |
|---------|-------------|--------|
| F4.1 | Progressive Web App — vault accesible desde cualquier browser mobile | ✅ |
| F4.2 | IndexedDB — reemplazo de chrome.storage con formato compatible | ✅ |
| F4.3 | OAuth PKCE — Google Drive + OneDrive sin chrome.identity | ✅ |
| F4.4 | UI responsive — mobile-first, touch-friendly | ✅ |
| F4.5 | Persistencia robusta — navigator.storage.persist() + manejo eviction iOS | ✅ |
| F4.6 | APK Android via TWA — distribución sin Play Store | ✅ |
| F4.7 | Formato versionado del blob — habilita migración no destructiva a Argon2id | ✅ |
| v0.4.1 | Remediación auditoría: importarVaultBackup (A-1), timeout GIS (M-1), errores OAuth (M-2), CSP sin unsafe-inline (M-3), fileId cache Drive (B-2), SW update flow (B-1) | ✅ |
| v0.4.2 | Auditoría #3: 4 Críticos (C1–C4) + 4 Altos (A2–A5) resueltos. Flujo multi-dispositivo "Restaurar desde tu nube" en Extension y PWA. Version display en popup. 7 criterios de aceptación verificados (round-trip manual 2026-06-06). | ✅ |
| v0.4.1 (Ext) / v0.4.3 (PWA) | Flujo "¿Olvidaste tu contraseña?" — escape hatch desde pantalla bloqueada para crear vault nuevo vacío. Principio ZK mantenido: datos cifrados anteriores irrecuperables por diseño. | ✅ |

### ⏳ Fase 4 — Monetización + UX v0.5.0 (PENDIENTE)

- Auto-lock timer en PWA (paridad con Extension)
- Integración Stripe — modelo de suscripción $1–1.50/mes LATAM
- Actualizar screenshots en CWS con nueva pantalla de desbloqueo

### ⏳ Fase 5 — Autofill Nativo v0.6.0 (PENDIENTE)

- iOS AutoFill Credential Provider Extension (Swift nativo)
- Android Autofill Service + Credential Manager API (Kotlin nativo)
- Apple App Store + listado público Chrome Web Store

---

## 🗺️ Roadmap

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.4.1 ✅  Ext: flujo "¿Olvidaste tu contraseña?" — escape hatch desde pantalla bloqueada
v0.4.2 ✅  Auditoría #3 — 4 críticos + 4 altos resueltos, sync multi-dispositivo
v0.4.3 ✅  PWA: paridad con v0.4.1 Ext — flujo "¿Olvidaste tu contraseña?"
v0.5.0 ⏳  Auto-lock PWA + integración Stripe (primer producto monetizado)
v0.6.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.7.0 ⏳  Argon2id opcional + preparación de auditoría
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS + App Store + Play Store
```

> Decisiones arquitecturales documentadas en `docs/decisions/`.

---

## 🚀 Instalación en modo desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/DacmosGroup/dacmosgroup-password-manager.git

# 2. Abrir Chrome → chrome://extensions/
# 3. Activar "Modo desarrollador" (esquina superior derecha)
# 4. Clic en "Cargar extensión sin empaquetar"
# 5. Seleccionar la carpeta raíz del proyecto
```

---

## 🌐 PWA — En producción

**`https://dpm.dacmosgroup.co`** — disponible en iOS, Android y Desktop directamente desde el navegador, sin instalación.

**Android:** también disponible como APK via GitHub Releases (distribución directa sin Play Store).

---

## 📦 Chrome Web Store

**v0.4.0 PUBLICADA** ✅ (aprobada 2026-06-08) · v0.4.1 en revisión. Instalación via enlace directo:

`https://chromewebstore.google.com/detail/dacmos-password-manager/aflgjjkallibohcebggkkjdlhdnainai`

---

## 🔑 Funciones Principales v0.4.3

- **Vault cifrado** — AES-256-GCM, tipos Login, Tarjeta e Identidad
- **Importar desde CSV** — Google PM, Bitwarden, LastPass, 1Password
- **TOTP integrado** — generador 2FA con cuenta regresiva, gratis
- **Password Health** — entropía, reutilización, HIBP k-anonymity
- **Exportar** — CSV genérico y CSV compatible con Bitwarden
- **Autocompletado** — login, checkout (tarjetas) y registro (identidades)
- **URL matching robusto** — dominio base, subdominios y wildcards
- **Lock automático** — chrome.alarms, cero persistencia de clave
- **Sync Google Drive** — OAuth drive.appdata, vault cifrado opaco, Zero-Knowledge
- **Sync OneDrive** — Microsoft Graph API, misma garantía de privacidad
- **BYOC** — tú eliges el proveedor cloud; DacmosGroup no almacena nada
- **Navegación consistente** — botón ← Inicio en todas las vistas
- **UX mejorada** — legibilidad de cards, versión dinámica, fix formularios registro
- **PWA Mobile** — vault accesible desde cualquier browser mobile en `dpm.dacmosgroup.co`
- **APK Android** — distribución directa via GitHub Releases (TWA, sin Play Store)
- **SW update flow** — banner "Nueva versión disponible" sin forzar cierre de tabs
- **¿Olvidaste tu contraseña?** — escape hatch desde pantalla bloqueada para crear vault nuevo vacío (principio ZK mantenido)

---

## 🏢 Sobre DacmosGroup

[DacmosGroup.co](https://dacmosgroup.co) es una plataforma de consultoría en TIC
especializada en las cuatro mega-tendencias que dominan la industria:
**Datos · Nube · Movilidad · Seguridad**

---

## 🔒 Política de Privacidad

[Ver política de privacidad](https://dacmosgroup.co/politica-de-privacidad-dacmosgroup-password-manager)

---

## 📄 Licencia

MIT License — ver [LICENSE](./LICENSE)

Junio 2026
