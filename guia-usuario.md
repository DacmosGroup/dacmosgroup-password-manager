# 📖 Guía de Usuario — DacmosGroup Password Manager

**Versión 0.1.0 · Abril 2026**
**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

---

## Tabla de Contenido

1. [¿Qué es DacmosGroup Password Manager?](#1-qué-es-dacmosgroup-password-manager)
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
7. [Preguntas Frecuentes](#7-preguntas-frecuentes)
8. [Solución de Problemas](#8-solución-de-problemas)
9. [Contacto y Soporte](#9-contacto-y-soporte)

---

## 1. ¿Qué es DacmosGroup Password Manager?

DacmosGroup Password Manager es una extensión para Chrome que te permite almacenar y gestionar tus contraseñas de forma segura, directamente en tu dispositivo.

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

> **Si olvidas tu contraseña maestra, no hay forma de recuperar tus credenciales.**
>
> No existe un mecanismo de recuperación por diseño — eso garantiza que nadie más pueda acceder a tus datos. Guarda tu contraseña maestra en un lugar seguro y realiza backups periódicos.

---

## 3. Requisitos

- **Navegador:** Google Chrome versión 88 o superior
- **Sistema Operativo:** Windows, macOS o Linux
- **Conexión a internet:** No requerida (funciona completamente offline)

---

## 4. Instalación

### Opción A — Chrome Web Store (Recomendada)

1. Abre Chrome y ve a la Chrome Web Store
2. Busca **"DacmosGroup Password Manager"**
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
   - Ejemplo: `DacmosGroup2024!`
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
- O desde la barra de navegación → **"Vault"**

**Agregar una credencial:**
1. Clic en **"+ Nueva"** o **"+ Agregar credencial"**
2. Llena los campos:
   - **Sitio / Servicio** *(obligatorio)*: nombre del sitio (ej. Gmail, GitHub)
   - **URL** *(opcional)*: dirección web (ej. https://gmail.com)
   - **Usuario / Email** *(obligatorio)*: tu nombre de usuario o email
   - **Contraseña** *(obligatorio)*: tu contraseña
   - **Notas** *(opcional)*: información adicional
3. Usa el botón ⚡ para generar una contraseña segura automáticamente
4. Observa el indicador de fortaleza
5. Clic en **"Guardar"**

**Editar una credencial:**
- Pasa el mouse sobre la credencial
- Clic en el ícono ✏️
- Modifica los campos necesarios
- Clic en **"Guardar"**

**Copiar una contraseña:**
- Pasa el mouse sobre la credencial
- Clic en el ícono 📋
- La contraseña se copia al portapapeles
- Se borrará automáticamente después de 30 segundos (configurable)

**Eliminar una credencial:**
- Pasa el mouse sobre la credencial
- Clic en el ícono 🗑️
- Confirma la eliminación

**Buscar credenciales:**
- Usa la barra de búsqueda en la parte superior
- Filtra por nombre del sitio, usuario o URL en tiempo real

---

### 6.2 Autocompletado

El autocompletado detecta formularios de login en las páginas web y completa tus credenciales automáticamente.

**¿Cómo funciona?**

1. Navega a cualquier sitio web con formulario de login
2. Verás el ícono 🔐 dentro del campo de contraseña
3. Asegúrate de tener el vault **desbloqueado**
4. Haz clic en el ícono 🔐
5. Si tienes credenciales guardadas para ese sitio, aparecerá un selector
6. Selecciona la credencial deseada
7. Los campos se llenarán automáticamente

**Badge inteligente:**
- El ícono de la extensión muestra un número azul cuando hay credenciales disponibles para el sitio actual
- Por ejemplo: **🔐 2** significa que tienes 2 credenciales para ese dominio

**¿No aparece el ícono?**
- Verifica que el vault esté desbloqueado
- Algunos sitios con diseños especiales pueden no detectarse automáticamente
- En ese caso, copia la contraseña manualmente desde el Vault

---

### 6.3 Generador de Contraseñas

El generador crea contraseñas seguras usando el motor criptográfico del navegador.

**Acceder al generador:**
- Desde el popup → clic en **"Generar"** en la barra de navegación

**Opciones disponibles:**

| Opción | Descripción | Valor por defecto |
|--------|-------------|------------------|
| Longitud | Número de caracteres (8-64) | 16 |
| Mayúsculas (A-Z) | Incluir letras mayúsculas | ✅ Activado |
| Minúsculas (a-z) | Incluir letras minúsculas | ✅ Activado |
| Números (0-9) | Incluir dígitos | ✅ Activado |
| Símbolos (!@#$...) | Incluir caracteres especiales | ✅ Activado |
| Excluir ambiguos | Excluir 0, O, l, 1, I | ❌ Desactivado |

**Indicadores de calidad:**
- **Fortaleza:** Muy débil / Débil / Regular / Fuerte / Muy fuerte / Excelente
- **Entropía:** Bits de aleatoriedad (80+ bits es seguro; 100+ es excelente)

**Historial:**
- Las últimas 5 contraseñas generadas aparecen en el historial
- Puedes copiar cualquiera con el botón 📋
- Clic en **"Limpiar"** para borrar el historial

---

### 6.4 Configuración y Seguridad

**Acceder a configuración:**
- Desde el popup → clic en **"Config"** en la barra de navegación

**Cambiar contraseña maestra:**
1. En la sección **"Contraseña Maestra"** verás el panel de cambio
2. Ingresa tu contraseña actual
3. Ingresa y confirma la nueva contraseña
4. Clic en **"Cambiar contraseña maestra"**

> 🔒 **Nota de seguridad:** Al cambiar la contraseña maestra, todo el vault se re-cifra con la nueva clave. Este proceso puede tardar unos segundos.

**Bloqueo automático:**
Configura cuánto tiempo puede estar el vault desbloqueado sin actividad:

| Opción | Recomendado para |
|--------|-----------------|
| 1 minuto | Computadoras compartidas |
| 5 minutos | Uso personal (recomendado) |
| 15 minutos | Trabajo intensivo |
| 30 minutos | Sesiones largas |
| Nunca | No recomendado |

**Limpiar portapapeles:**
Tiempo tras el cual se borra automáticamente la contraseña copiada:
- Recomendado: **30 segundos**

**Bloquear manualmente:**
- Desde el popup → clic en **"Bloquear"** en la barra de navegación

---

### 6.5 Backup del Vault

Es importante realizar backups periódicos de tu vault.

**Exportar vault:**
1. Ve a Configuración → sección **"Backup del Vault"**
2. Clic en **"Exportar"**
3. Ingresa tu contraseña maestra para confirmar
4. Clic en **"Descargar backup"**
5. Se descargará un archivo: `dacmosgroup-vault-backup-FECHA.json`

> 🔒 **El archivo exportado está cifrado con AES-256-GCM.** Sin tu contraseña maestra es completamente ilegible. Puedes guardarlo en la nube sin riesgo.

**Importar vault:**
1. Ve a Configuración → sección **"Backup del Vault"**
2. Clic en **"Importar"**
3. Selecciona el archivo `.json` de backup
4. Ingresa la contraseña maestra del backup
5. Clic en **"Importar credenciales"**

> 💡 **Fusión inteligente:** Al importar, las credenciales se fusionan con las existentes — no se pierden datos actuales.

**¿Con qué frecuencia hacer backup?**
- Al agregar nuevas credenciales importantes
- Al menos una vez por semana si lo usas frecuentemente
- Antes de cambiar la contraseña maestra

---

## 7. Preguntas Frecuentes

**¿Qué pasa si olvido mi contraseña maestra?**

No existe mecanismo de recuperación — esto es por diseño para garantizar el modelo Zero-Knowledge. Si olvidas la contraseña maestra, no podrás acceder a tus credenciales guardadas. Por eso es crucial:
- Recordarla bien
- Tener un backup reciente
- Guardar la contraseña en un lugar físico seguro

---

**¿Puedo usar la extensión en múltiples computadoras?**

La versión actual (0.1.0) es local-first — los datos viven en el dispositivo donde se instaló. Para usar en otra computadora, exporta el vault desde el dispositivo original e impórtalo en el nuevo.

La sincronización automática entre dispositivos está planeada para **Fase 2** (Azure Blob Storage).

---

**¿Qué tan seguro es el archivo de backup?**

El archivo `.json` exportado está cifrado con AES-256-GCM usando tu contraseña maestra. Sin esa contraseña, el archivo es completamente ilegible. Puedes almacenarlo en servicios de nube como Google Drive o OneDrive sin riesgo.

---

**¿Por qué tarda unos segundos al desbloquear?**

Esto es intencional y es una característica de seguridad. El proceso PBKDF2-SHA256 con 600,000 iteraciones tarda ~1 segundo en derivar la clave criptográfica. Este tiempo es insignificante para el usuario pero hace computacionalmente inviable un ataque de fuerza bruta.

---

**¿La extensión funciona sin internet?**

Sí, completamente. Todo el cifrado y almacenamiento es local. No necesitas conexión a internet para usar ninguna función.

---

**¿Qué sitios detecta el autocompletado?**

El autocompletado detecta cualquier página web que tenga un campo de tipo `password`. Funciona en la gran mayoría de sitios. En casos excepcionales donde el diseño del sitio sea muy inusual, puede que no detecte los campos automáticamente.

---

**¿Puedo confiar en esta extensión?**

El código fuente es completamente abierto y disponible en:
`github.com/DacmosGroup/dacmosgroup-password-manager`

Puedes auditar cada línea de código. No existen servidores externos ni telemetría. Todo ocurre en tu dispositivo.

---

## 8. Solución de Problemas

### El ícono 🔐 no aparece en los campos de login

**Solución:**
1. Verifica que el vault esté desbloqueado (badge verde en el ícono)
2. Recarga la página con F5
3. Si persiste, ve a `chrome://extensions/` y recarga la extensión con el botón 🔄

---

### "Contraseña incorrecta" al desbloquear

**Posibles causas:**
- Escribiste la contraseña con Caps Lock activado
- Hay un espacio al inicio o final de la contraseña

**Solución:**
1. Usa el ícono 👁 para ver la contraseña mientras la escribes
2. Verifica que no haya espacios extras

---

### El autocompletado no encuentra credenciales para un sitio

**Posibles causas:**
- La URL guardada no coincide con el dominio actual
- El vault se bloqueó — necesitas desbloquearlo de nuevo

**Solución:**
1. Desbloquea el vault desde el popup
2. Verifica que la URL de la credencial guardada sea correcta
3. Edita la credencial y actualiza la URL

---

### La extensión muestra errores en `chrome://extensions/`

**Solución:**
1. Ve a `chrome://extensions/`
2. Busca DacmosGroup Password Manager
3. Clic en **"Errores"** para ver el detalle
4. Clic en **"Borrar todo"** para limpiar errores anteriores
5. Clic en 🔄 para recargar la extensión

---

### Perdí mis credenciales después de reinstalar Chrome

Las credenciales se almacenan en `chrome.storage.local`, que puede borrarse al reinstalar Chrome o cambiar de perfil.

**Prevención:** Realiza backups periódicos desde Configuración → Exportar vault.

**Si tienes un backup:** Importa el archivo desde Configuración → Importar vault.

---

## 9. Contacto y Soporte

**Sitio web:** [dacmosgroup.co](https://dacmosgroup.co)

**Email de soporte:** security@dacmosgroup.com

**Repositorio:** [github.com/DacmosGroup/dacmosgroup-password-manager](https://github.com/DacmosGroup/dacmosgroup-password-manager)

**Política de privacidad:** [dacmosgroup.co/politica-de-privacidad-dacmosgroup-password-manager](https://dacmosgroup.co/politica-de-privacidad-dacmosgroup-password-manager)

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
