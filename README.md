# 🔐 DacmosGroup Password Manager

**Gestor de contraseñas local-first para Chrome — construido en público por [DacmosGroup.com](https://dacmosgroup.co)**

> Este proyecto es simultáneamente una herramienta funcional y contenido educativo
> sobre seguridad de la información aplicada.

[![Estado](https://img.shields.io/badge/Estado-En%20Revisión%20Chrome%20Web%20Store-blue)](https://dacmosgroup.co)
[![Versión](https://img.shields.io/badge/Versión-0.1.0-green)](https://github.com/DacmosGroup/dacmosgroup-password-manager)
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

### ⏳ Fase 2 — Sincronización Azure (PENDIENTE)
- Sincronización via **Azure Blob Storage**
- El vault viaja cifrado — Azure nunca ve los datos en claro
- Autenticación via Microsoft Account

### 📱 Fase 3 — Android App (PENDIENTE)
- React Native
- Reutiliza motor de cifrado de Fase 1
- Biometría con expo-local-authentication

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

> 🕐 **Pendiente de aprobación** — enviado a revisión el 7 de abril de 2026

Una vez aprobada, la extensión estará disponible en:
`https://chrome.google.com/webstore/detail/dacmosgroup-password-manager`

---

## 🔑 Funciones Principales

- **Vault cifrado** — almacena credenciales con AES-256-GCM
- **Autocompletado inteligente** — detecta formularios de login en cualquier sitio
- **Generador de contraseñas** — criptográfico con cálculo de entropía en bits
- **Lock automático** — bloqueo por inactividad con chrome.alarms
- **Badge inteligente** — indica credenciales disponibles para el sitio actual
- **Backup cifrado** — exportar e importar vault sin exponer datos

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
