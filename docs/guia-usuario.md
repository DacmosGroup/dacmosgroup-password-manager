# 📖 Guía de Usuario — Dacmos Password Manager

**Versión 0.4.3 · Junio 2026**
**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

---

## Tabla de Contenido

1. [¿Qué es Dacmos Password Manager?](#1-qué-es-dacmosgroup-password-manager)
2. [Modelo de Seguridad — Lo que debes saber](#2-modelo-de-seguridad)
3. [Requisitos](#3-requisitos)
4. [Instalación](#4-instalación)
5. [Primeros Pasos](#5-primeros-pasos)
6. [Funciones Principales](#6-funciones-principales)
   - 6.1 [Mi Vault — Gestión de Credenciales](#61-mi-vault)
   - 6.2 [Autocompletado](#62-autocompletado)
   - 6.3 [Generador de Contraseñas](#63-generador-de-contraseñas)
   - 6.4 [Configuración y Seguridad](#64-configuración-y-seguridad)
   - 6.5 [Backup del Vault](#65-backup-del-vault)
   - 6.6 [Sincronización multi-dispositivo](#66-sincronización-multi-dispositivo)
7. [Preguntas Frecuentes](#7-preguntas-frecuentes)
8. [Solución de Problemas](#8-solución-de-problemas)
9. [Contacto y Soporte](#9-contacto-y-soporte)

---

## 1. ¿Qué es Dacmos Password Manager?

Dacmos Password Manager es una extensión para Chrome que te permite almacenar y gestionar tus contraseñas de forma segura, directamente en tu dispositivo.

A diferencia de otros gestores de contraseñas, **tus datos nunca salen de tu computadora**. No existe ningún servidor externo que almacene tus credenciales — ni siquiera DacmosGroup tiene acceso a ellas.

### ¿Para quién es?

- Profesionales de TI que manejan múltiples cuentas
- Usuarios que buscan mayor seguridad sin depender de servicios en la nube
- Empresas que requieren control total sobre sus credenciales
- Cualquier persona que quiera dejar de reutilizar contraseñas

### ¿Qué puede hacer?

| Función | Descripción |
|---------|-------------|
| 🗄️ Vault cifrado | Almacena credenciales con cifrado AES-256-GCM |
| 🔐 Autocompletado | Detecta formularios de login y completa automáticamente |
| ⚡ Generador | Crea contraseñas seguras con cálculo de entropía |
| 🔒 Lock automático | Bloquea el vault tras inactividad configurable |
| 💾 Backup | Exporta e importa tu vault de forma segura |
| 🔢 Badge | Muestra cuántas credenciales tienes para cada sitio |
| 🔄 Sincronización | Vault cifrado en Google Drive u OneDrive — multi-dispositivo |

---

## 2. Modelo de Seguridad

> Esta sección explica cómo protegemos tus datos. Recomendamos leerla antes de comenzar.

### Zero-Knowledge: ¿Qué significa?

**Zero-Knowledge** significa que ni DacmosGroup ni nadie más puede acceder a tus contraseñas. El cifrado ocurre completamente en tu dispositivo, antes de que cualquier dato se almacene.

### ¿Cómo funciona el cifrado?

```
Tu contraseña maestra
        ↓
PBKDF2-SHA256 (600,000 iteraciones)
        ↓
Clave criptográfica AES-256 (en memoria)
        ↓
AES-256-GCM cifra tus credenciales
        ↓
Datos cifrados almacenados localmente
```

### Estándares utilizados

| Componente | Estándar | ¿Por qué? |
|-----------|---------|-----------|
| Cifrado | AES-256-GCM (NIST FIPS 197) | Estándar bancario y gubernamental |
| Derivación de clave | PBKDF2-SHA256, 600,000 iteraciones | Hace inviable la fuerza bruta |
| Almacenamiento | chrome.storage.local | Los datos nunca salen del dispositivo |
| Motor criptográfico | Web Crypto API nativa | Sin librerías de terceros vulnerables |

### ⚠️ Advertencia importante

> **Si olvidas tu contraseña maestra, no hay forma de recuperar tus credenciales existentes.**
>
> No existe un mecanismo de recuperación por diseño — eso garantiza que nadie más pueda acceder a tus datos. Guarda tu contraseña maestra en un lugar seguro y realiza backups periódicos.
>
> Si pierdes tu contraseña maestra puedes crear un vault nuevo vacío desde la pantalla de desbloqueo ("¿Olvidaste tu contraseña?"). El vault anterior y sus backups quedan permanentemente inaccesibles — esta acción no se puede deshacer.

---

## 3. Requisitos

- **Navegador:** Google Chrome versión 88 o superior
- **Sistema Operativo:** Windows, macOS o Linux
- **Conexión a internet:** No requerida (funciona completamente offline)

---

## 4. Instalación

### Opción A — Chrome Web Store (Recomendada)

1. Abre Chrome y ve a la Chrome Web Store
2. Busca **"Dacmos Password Manager"**
3. Clic en **"Añadir a Chrome"**
4. Confirma con **"Añadir extensión"**

El ícono de DacmosGroup aparecerá en la barra de herramientas de Chrome.

### Opción B — Instalación manual (Modo desarrollador)

Para instalar desde el código fuente:

1. Descarga o clona el repositorio:
   ```
   https://github.com/DacmosGroup/dacmosgroup-password-manager
   ```

2. Abre Chrome y navega a:
   ```
   chrome://extensions/
   ```

3. Activa el **"Modo desarrollador"** (switch en la esquina superior derecha)

4. Clic en **"Cargar extensión sin empaquetar"**

5. Selecciona la carpeta del proyecto descargado

6. El ícono de DacmosGroup aparecerá en la barra de Chrome

---

## 5. Primeros Pasos

### Paso 1 — Abrir la extensión

Haz clic en el ícono 🔐 de DacmosGroup en la barra de Chrome. Si no lo ves, haz clic en el ícono de piezas de puzzle 🧩 y busca DacmosGroup.

### Paso 2 — Configurar tu contraseña maestra

La primera vez que abras la extensión verás la pantalla de **Bienvenida**.

1. Clic en **"Configurar ahora →"**
2. Se abrirá la página de Configuración
3. En la sección **"Contraseña Maestra"** ingresa una contraseña segura:
   - Mínimo 12 caracteres
   - Combina mayúsculas, minúsculas, números y símbolos
4. Confírmala en el segundo campo
5. Observa el indicador de fortaleza — busca **"Muy fuerte"** o **"Excelente"**
6. Clic en **"Guardar contraseña maestra"**

> 💡 **Tip:** Usa el generador de contraseñas de la extensión para crear tu propia contraseña maestra. Luego guárdala en un lugar físico seguro.

### Paso 3 — Desbloquear el vault

Después de configurar la contraseña maestra, el vault queda bloqueado por seguridad.

1. Haz clic en el ícono de la extensión
2. Ingresa tu contraseña maestra
3. Clic en **"Desbloquear"**
4. El badge cambiará de 🔴 **Bloqueado** a 🟢 **Desbloqueado**

---

## 6. Funciones Principales

### 6.1 Mi Vault

El Vault es donde se almacenan todas tus credenciales cifradas.

**Acceder al Vault:**
- Desde el popup → clic en **"Mi Vault"**

**Agregar una credencial:**
1. Clic en **"+ Nueva"** o **"+ Agregar credencial"**
2. Llena los campos requeridos
3. Usa el botón ⚡ para generar una contraseña segura automáticamente
4. Clic en **"Guardar"**

**Copiar una contraseña:**
- Pasa el mouse sobre la credencial → clic en el ícono 📋
- La contraseña se borra del portapapeles automáticamente después de 30 segundos

**Buscar credenciales:**
- Usa la barra de búsqueda en la parte superior para filtrar en tiempo real

**Navegar entre secciones:**
- Todas las vistas (Vault, Health, Generator, Settings) tienen un botón **← Inicio**
  en la esquina superior izquierda para volver al punto de partida.

---

### 6.2 Autocompletado

El autocompletado detecta formularios de login en las páginas web y completa tus credenciales automáticamente.

**¿Cómo funciona?**

1. Navega a cualquier sitio web con formulario de login
2. Verás el ícono 🔐 dentro del campo de contraseña
3. Asegúrate de tener el vault **desbloqueado**
4. Haz clic en el ícono 🔐
5. Selecciona la credencial deseada en el selector
6. Los campos se llenarán automáticamente

**Formularios de registro (Create/Confirm password):**
El autocompletado detecta correctamente el primer campo password del formulario.
En formularios con "Create password" y "Confirm password", la contraseña
se llena en el campo correcto (Create), no en la confirmación.

**¿El ícono aparece pero dice "No hay credenciales"?**

Lo más probable es que el vault esté bloqueado. Verifica el badge del ícono de
la extensión — si aparece en rojo o sin número, desbloquea el vault primero
y vuelve a intentarlo.

> 💡 Configura el **bloqueo automático** en 5 minutos o más si usas el
> autocompletado con frecuencia (Configuración → Bloqueo automático).

---

### 6.3 Generador de Contraseñas

El generador crea contraseñas seguras usando el motor criptográfico del navegador.

**Opciones disponibles:**

| Opción | Valor por defecto |
|--------|------------------|
| Longitud (8-64) | 16 |
| Mayúsculas (A-Z) | ✅ Activado |
| Minúsculas (a-z) | ✅ Activado |
| Números (0-9) | ✅ Activado |
| Símbolos (!@#$...) | ✅ Activado |
| Excluir ambiguos | ❌ Desactivado |

**Indicadores de calidad:**
- **Entropía:** 100+ bits es excelente; 80+ bits es seguro

---

### 6.4 Configuración y Seguridad

**Bloqueo automático — recomendaciones:**

| Opción | Recomendado para |
|--------|-----------------|
| 1 minuto | Computadoras compartidas |
| 5 minutos | Uso personal (recomendado) |
| 15 minutos | Trabajo intensivo |
| 30 minutos | Sesiones largas |

> 💡 Un tiempo de bloqueo muy corto (1 minuto) puede hacer que el vault
> se bloquee mientras navegas entre tabs, lo que afecta el autocompletado.
> **5 minutos es el balance recomendado** entre seguridad y comodidad.

---

### 6.5 Backup del Vault

**Exportar vault:**
1. Ve a Configuración → sección **"Backup del Vault"**
2. Clic en **"Exportar"** → ingresa tu contraseña maestra → **"Descargar backup"**
3. Archivo: `dacmosgroup-vault-backup-FECHA.json`

> 🔒 El archivo exportado está cifrado con AES-256-GCM. Sin tu contraseña
> maestra es completamente ilegible.

**Importar vault:**
1. Ve a Configuración → **"Importar"**
2. Selecciona el archivo `.json` de backup
3. Ingresa la contraseña maestra del backup

---

### 6.6 Sincronización multi-dispositivo

La sincronización mantiene tu vault actualizado en todos tus dispositivos usando
tu propio almacenamiento en la nube (**BYOC — Bring Your Own Cloud**).

#### Conectar Google Drive

1. Ve a Configuración → **"🔄 Sincronización multi-dispositivo"**
2. Clic en **"Conectar con Google"**
3. Acepta el permiso `drive.appdata` (solo carpeta privada de la app)
4. El badge cambiará a **✅ Sincronizado**

#### Conectar OneDrive

1. Ve a Configuración → **"🔄 Sincronización multi-dispositivo"**
2. Clic en **"Conectar con Microsoft"**
3. Acepta el permiso de acceso a la carpeta de la app

#### Estados de sincronización

| Estado | Significado |
|--------|------------|
| **Desconectado** | Vault solo local |
| **Sincronizando…** | Subiendo o descargando el vault cifrado |
| **Sincronizado** | Local y remoto al día |
| **Pendiente** | Hay cambios locales aún no subidos |
| **Error** | Problema de red — intenta "Sincronizar ahora" |

> El proveedor cloud nunca recibe tu clave maestra. Zero-Knowledge se
> mantiene intacto con la sincronización activa.

---

## 7. Preguntas Frecuentes

**¿Qué pasa si olvido mi contraseña maestra?**

Tus credenciales cifradas son irrecuperables — esto es por diseño (Zero-Knowledge). Sin embargo, desde v0.4.1 puedes crear un vault nuevo vacío sin desinstalar la app:

1. En la pantalla de desbloqueo, haz clic en **"¿Olvidaste tu contraseña?"**
2. Lee la advertencia — tu vault anterior y todos sus backups quedarán inaccesibles
3. Confirma con **"Crear vault nuevo"**
4. Configura una nueva contraseña maestra y empieza desde cero

Prevención: realiza backups periódicos desde Configuración → Exportar vault, y guarda tu contraseña maestra en un lugar físico seguro.

---

**El autocompletado muestra "No hay credenciales guardadas" pero sí tengo credenciales.**

Casi siempre es porque el vault se bloqueó. Abre el popup de la extensión,
desbloquea con tu contraseña maestra, y vuelve a intentar el autocompletado.
Considera aumentar el tiempo de bloqueo automático a 5 minutos.

---

**¿Puedo usar la extensión en múltiples computadoras?**

Sí. Conecta Google Drive u OneDrive en Configuración → **"Sincronización
multi-dispositivo"** para sincronizar automáticamente.

---

**¿Por qué tarda unos segundos al desbloquear?**

Es intencional. PBKDF2-SHA256 con 600,000 iteraciones tarda ~1 segundo
para hacer computacionalmente inviable un ataque de fuerza bruta.

---

**¿La extensión funciona sin internet?**

Sí, completamente offline. La sincronización requiere conexión, pero
todas las demás funciones son locales.

---

**¿Puedo confiar en esta extensión?**

El código fuente es completamente abierto:
`github.com/DacmosGroup/dacmosgroup-password-manager`

No hay servidores externos ni telemetría. Todo ocurre en tu dispositivo.

---

## 8. Solución de Problemas

### El ícono 🔐 no aparece en los campos de login

1. Verifica que el vault esté desbloqueado
2. Recarga la página con F5
3. Si persiste, ve a `chrome://extensions/` y recarga la extensión con 🔄

---

### "No hay credenciales guardadas" al hacer clic en el ícono 🔐

**Causa más probable:** el vault se bloqueó automáticamente.

1. Haz clic en el ícono de la extensión en la barra de Chrome
2. Desbloquea con tu contraseña maestra
3. Vuelve a hacer clic en el ícono 🔐 del formulario

Si el problema persiste con el vault desbloqueado, verifica que la URL
de la credencial guardada corresponda al dominio del sitio actual.

---

### "Contraseña incorrecta" al desbloquear

1. Usa el ícono 👁 para ver la contraseña mientras la escribes
2. Verifica que Caps Lock no esté activado
3. Verifica que no haya espacios al inicio o final

---

### Perdí mis credenciales después de reinstalar Chrome

Las credenciales se almacenan en `chrome.storage.local`, que se borra al
reinstalar Chrome. **Prevención:** realiza backups periódicos desde
Configuración → Exportar vault.

---

## 9. Contacto y Soporte

**Sitio web:** [dacmosgroup.co](https://dacmosgroup.co)

**Email de soporte:** dacmosgroup@gmail.com

**Repositorio:** [github.com/DacmosGroup/dacmosgroup-password-manager](https://github.com/DacmosGroup/dacmosgroup-password-manager)

**Política de privacidad:** [dacmosgroup.co/politica-de-privacidad-dacmosgroup-password-manager](https://dacmosgroup.co/politica-de-privacidad-dacmosgroup-password-manager)

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
