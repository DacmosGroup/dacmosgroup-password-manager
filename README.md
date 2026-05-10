# 🔐 Dacmos Password Manager

**Gestor de contraseñas local-first para Chrome — construido en público por [DacmosGroup.co](https://dacmosgroup.co)**

> Este proyecto es simultáneamente una herramienta funcional y contenido educativo
> sobre seguridad de la información aplicada.

[![Estado](https://img.shields.io/badge/Estado-Publicado-green)](https://dacmosgroup.co)
[![Versión](https://img.shields.io/badge/Versión-0.3.0-green)](https://github.com/DacmosGroup/dacmosgroup-password-manager)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow)](./LICENSE)

---

## 🛡️ Modelo de Seguridad

| Componente          | Estándar                                                |
|---------------------|---------------------------------------------------------|
| Cifrado             | AES-256-GCM (NIST FIPS 197)                             |
| Derivación de clave | PBKDF2-SHA256, 600,000 iteraciones (OWASP 2024)         |
| Almacenamiento      | chrome.storage.local (cifrado local)                    |
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

### 📱 Fase 3 — App móvil (PENDIENTE)
- React Native (iOS + Android)
- Reutiliza motor de cifrado
- Biometría con Face ID / Touch ID

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

## 📦 Chrome Web Store

Disponible en modo no listado — instalación via enlace directo:

`https://chromewebstore.google.com/detail/dacmos-password-manager/aflgjjkallibohcebggkkjdlhdnainai`

---

## 🔑 Funciones Principales v0.3.0

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

Abril 2026