# 📖 Guía de Usuario — Dacmos Password Manager v0.2.0
## Instrucciones de integración
Actualizar encabezado: "Versión 0.2.0 · Abril 2026"
Agregar secciones 6.6 a 6.10 después de la sección 6.5 (Backup del Vault)
Actualizar la tabla de funciones en la sección 1

---

## ACTUALIZACIÓN — Tabla de funciones (Sección 1)

Reemplazar la tabla por:

| Función | Descripción |
|---------|-------------|
| 🗄️ Vault cifrado | Login, Tarjeta de crédito e Identidad con AES-256-GCM |
| 🔐 Autocompletado | Login, formularios de checkout y de registro |
| ⚡ Generador | Contraseñas seguras con cálculo de entropía |
| 🔢 TOTP integrado | Generador 2FA con cuenta regresiva — gratis |
| 📥 Importar CSV | Google PM, Bitwarden, LastPass, 1Password, genérico |
| 📤 Exportar CSV | Formato genérico y compatible con Bitwarden |
| 🏥 Password Health | Detecta contraseñas débiles, reutilizadas y filtradas |
| 🔒 Lock automático | Bloqueo por inactividad configurable |
| 💾 Backup cifrado | Exportar e importar vault JSON cifrado |
| 🌐 URL matching | Reconoce subdominios y dominios relacionados |

---

## NUEVAS SECCIONES

---

### 6.6 Importar desde otros gestores

Dacmos puede importar tus contraseñas desde Google Password Manager,
Bitwarden, LastPass, 1Password, o cualquier archivo CSV genérico.

**Pasos:**
1. Ve a **Configuración** → sección **"Backup del Vault"**
2. Clic en **"Importar desde gestor externo"**
3. Aparece la advertencia de seguridad — léela antes de continuar
4. Selecciona tu archivo `.csv` exportado desde el otro gestor
5. Dacmos detecta automáticamente el formato (Google PM, Bitwarden, etc.)
6. Revisa la **vista previa** — tus contraseñas aparecen enmascaradas
7. Clic en **"Importar X credenciales"**
8. Verás el reporte: cuántas se importaron y cuántas ya existían

**¿Cómo exportar desde cada gestor?**
- **Google Password Manager**: passwords.google.com → Configuración → Exportar
- **Bitwarden**: Mi bóveda → Exportar bóveda → Formato CSV
- **LastPass**: Configuración de cuenta → Exportar → LastPass CSV
- **1Password**: Archivo → Exportar → Todos los ítems → CSV

> ⚠️ **Seguridad:** Los archivos CSV exportados contienen tus contraseñas
> en texto plano. Elimínalos de tu computadora después de importar.

---

### 6.7 Generador TOTP (Autenticador 2FA)

Dacmos incluye un generador de códigos 2FA integrado — no necesitas
una app separada como Google Authenticator.

**Agregar TOTP a una credencial:**
1. Abre o edita cualquier credencial de tipo Login
2. Busca el campo **"Clave TOTP (2FA) — opcional"**
3. Copia la clave Base32 de tu servicio (usualmente una cadena como `JBSWY3DPEHPK3PXP`)
   - En la mayoría de servicios, aparece cuando activas 2FA con la opción "no puedo escanear el QR"
4. Pégala en el campo y guarda

**Usar el código TOTP:**
- En el vault, las credenciales con TOTP muestran un badge:
  `[ 4 8 7 2 3 1 ]  ████████░░  22s`
- El número de 6 dígitos se renueva cada 30 segundos
- Clic en el botón 📋 junto al código para copiarlo al portapapeles

> 💡 **Tip:** El código TOTP se almacena cifrado junto a la contraseña —
> con el mismo nivel de seguridad AES-256-GCM.

---

### 6.8 Password Health — Salud de tus contraseñas

Password Health analiza todas tus contraseñas y te indica cuáles
necesitan atención.

**Acceder al análisis:**
1. Ve a **Mi Vault**
2. Clic en el botón **"Health Check"** en el encabezado
3. Se abre el dashboard de salud

**Qué analiza:**

| Indicador | Descripción |
|-----------|-------------|
| ✅ Segura | Sin problemas detectados |
| ⚠️ Débil | Entropía baja — contraseña predecible |
| 🔁 Reutilizada | La misma contraseña en múltiples sitios |
| 🚨 Comprometida | Encontrada en filtraciones conocidas (HIBP) |

**¿Cómo funciona la verificación de filtraciones?**

Dacmos usa el protocolo **k-anonymity** de Have I Been Pwned:
- Solo se envían los primeros 5 caracteres del hash de tu contraseña
- Nunca se envía la contraseña en texto plano
- La comparación final ocurre en tu dispositivo

> 🔒 **Privacidad garantizada:** ni Have I Been Pwned ni nadie más
> puede conocer tus contraseñas a partir de esta consulta.

---

### 6.9 Tipos de credencial: Tarjeta e Identidad

Además de contraseñas de login, Dacmos guarda tarjetas de crédito
y datos de identidad — todos cifrados con el mismo estándar.

**Agregar una tarjeta de crédito:**
1. En Mi Vault, clic en **"+ Nueva"**
2. Selecciona la pestaña **"💳 Tarjeta"**
3. Completa: alias (ej. "Visa Personal"), titular, número, vencimiento y CVV
4. Guarda — el número y CVV quedan cifrados

**Ver datos de una tarjeta:**
- El número siempre aparece como `**** **** **** 1234`
- Clic en el ícono 👁 para revelar — se oculta automáticamente en 5 segundos
- El CVV también se puede revelar temporalmente

**Agregar una identidad:**
1. Selecciona la pestaña **"👤 Identidad"**
2. Completa: nombre, email, teléfono, dirección, ciudad y país
3. Dacmos autocompleta formularios de registro con estos datos

**Autocompletado de tarjetas:**
- En páginas de pago/checkout, aparece el ícono 🔐 en el campo de tarjeta
- Selecciona tu tarjeta y los campos se completan automáticamente

---

### 6.10 Exportar credenciales

Además del backup cifrado (JSON), Dacmos puede exportar en formatos
compatibles con otros gestores.

**Exportar CSV genérico:**
1. Configuración → **"Exportar CSV genérico"**
2. Lee la advertencia de seguridad y marca la casilla de confirmación
3. Ingresa tu contraseña maestra
4. Clic en **"Descargar CSV"**
5. Se descarga `dacmos-export-YYYY-MM-DD.csv`

**Exportar compatible con Bitwarden:**
1. Configuración → **"Exportar CSV Bitwarden"**
2. Mismos pasos — el archivo incluye también tus claves TOTP

> ⚠️ **Los archivos CSV no están cifrados.** Contienen todas tus
> contraseñas en texto plano. Úsalos solo para migrar a otro gestor
> y elimínalos inmediatamente después.

---

## ACTUALIZACIÓN — Sección 7 (Preguntas Frecuentes)

Agregar estas preguntas al final:

---

**¿Puedo usar el TOTP de Dacmos en lugar de Google Authenticator?**

Sí. Dacmos genera códigos TOTP exactamente igual que Google Authenticator,
Microsoft Authenticator o Authy — todos siguen el estándar RFC 6238.
La diferencia es que la clave TOTP queda cifrada junto a la contraseña,
en un solo lugar seguro.

---

**¿Mis tarjetas de crédito están realmente seguras?**

Sí. El número de tarjeta y el CVV se cifran con AES-256-GCM — el mismo
estándar que las contraseñas. Nunca aparecen en texto plano en el vault.
El revelado temporal de 5 segundos es solo visual en memoria — el valor
no se copia ni persiste fuera del cifrado.

---

**¿Password Health envía mis contraseñas a internet?**

No. La verificación de filtraciones usa el protocolo k-anonymity de
Have I Been Pwned: solo se envían los primeros 5 caracteres del hash
de tu contraseña (no la contraseña en sí). La comparación final
ocurre en tu dispositivo. Es matemáticamente imposible reconstruir
tu contraseña a partir de esos 5 caracteres.

---

**¿Por qué Dacmos reconoce gmail.com y drive.google.com como el mismo sitio?**

A partir de v0.2.0, Dacmos usa matching por dominio base — reconoce
que ambos pertenecen a google.com. Esto también corrige un bug de
seguridad previo donde sitios maliciosos podrían haber provocado
falsos positivos.

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
> *Datos · Nube · Movilidad · Seguridad*
> Versión 0.2.0 · Abril 2026
