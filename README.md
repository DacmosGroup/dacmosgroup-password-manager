# 🔐 DacmosGroup Password Manager

**Gestor de contraseñas local-first para Chrome — construido en público por [DacmosGroup.com](https://dacmosgroup.com)**

> Este proyecto es simultáneamente una herramienta funcional y contenido educativo
> sobre seguridad de la información aplicada.

---

## 🛡️ Modelo de Seguridad

| Componente          | Estándar                                            |
|---------------------|-----------------------------------------------------|
| Cifrado             | AES-256-GCM (NIST FIPS 197)                         |
| Derivación de clave | PBKDF2-SHA256, 600,000 iteraciones (OWASP 2024)     |
| Almacenamiento      | chrome.storage.local (cifrado local)                |
| Modelo              | Zero-Knowledge — tus datos nunca salen del dispositivo |
| Cripto engine       | Web Crypto API nativa — sin librerías de terceros   |

---

## 📋 Fases del Proyecto

- [x] **Fase 1** — Chrome Extension MVP *(en curso)*
- [ ] **Fase 2** — Android App (React Native)
- [ ] **Fase 3** — Contenido Educativo / Documentación

### Entregables Fase 1

- [x] E1.1 Repositorio configurado
- [ ] E1.2 UI base (popup, vault, settings)
- [ ] E1.3 Motor de cifrado AES-256-GCM + PBKDF2
- [ ] E1.4 Gestión de Master Password
- [ ] E1.5 CRUD de credenciales
- [ ] E1.6 Generador de contraseñas seguras
- [ ] E1.7 Autodetección de campos de login
- [ ] E1.8 Autocompletado (content script)
- [ ] E1.9 Lock automático por inactividad
- [ ] E1.10 Exportar vault cifrado (backup)

---

## 🚀 Instalación en modo desarrollo
```bash