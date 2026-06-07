# Dacmos Password Manager — Guía de inicio rápido

**v0.4.0 · Junio 2026 · DacmosGroup.co**

---

## ¿Qué es esto?

Un gestor de contraseñas hecho en Latinoamérica. Guarda todas tus contraseñas cifradas en tu propio dispositivo — ningún servidor externo las ve, ni siquiera nosotros.

Funciona en el navegador (PC/Mac), como extensión de Chrome y como app en Android.

---

## ¿Por dónde empiezo?

Elige la opción que más te convenga:

| Opción | Ideal para | Cómo acceder |
|--------|-----------|--------------|
| **Web (PWA)** | Cualquier dispositivo, sin instalar nada | `dpm.dacmosgroup.co` en Chrome o Safari |
| **Extensión Chrome** | PC/Mac — autocompletado automático en sitios | Chrome Web Store → buscar "Dacmos Password Manager" |
| **App Android** | Celular Android | Instalar desde `dpm.dacmosgroup.co` → menú del browser → "Añadir a pantalla de inicio" |

> Si es tu primera vez, **empieza por la web** (`dpm.dacmosgroup.co`). Es la forma más rápida.

---

## Primeros pasos — 5 minutos

### Paso 1 — Abre la app

Ve a `dpm.dacmosgroup.co` en tu navegador.

---

### Paso 2 — Crea tu vault

Clic en **"Crear vault nuevo"** → elige tu **contraseña maestra**.

**¿Cómo elegir una buena contraseña maestra?**
- Mínimo 12 caracteres
- Mezcla palabras, números y símbolos — ej. `Café$Seguro!2024`
- Que la puedas recordar sin escribirla en ningún lado digital

> ⚠️ **MUY IMPORTANTE — lee esto antes de continuar:**
>
> Tu contraseña maestra **no tiene recuperación**. Si la olvidas, perderás acceso a todas tus credenciales — no existe un "olvidé mi contraseña" porque nadie más la conoce, ni nosotros.
>
> **Antes de guardar nada importante: anótala en papel y guárdala en un lugar físico seguro.**

---

### Paso 3 — Agrega tu primera credencial

Clic en **"+ Nueva"** → llena los campos:
- **Sitio**: el nombre del servicio (ej. Gmail, Netflix, tu banco)
- **Usuario**: tu email o nombre de usuario
- **Contraseña**: pégala o usa el botón ⚡ para generar una nueva segura

Clic en **Guardar**. Ya está cifrada.

---

### Paso 4 — Prueba el autocompletado (solo Extensión Chrome)

Si instalaste la extensión, navega a cualquier sitio con login. Verás el ícono 🔐 dentro del campo de contraseña — haz clic y selecciona tu credencial. Los campos se llenan solos.

---

### Paso 5 — Activa la sincronización (opcional pero recomendado)

Para tener tus contraseñas en todos tus dispositivos:

1. Ve a **Config** → **Sincronización**
2. Clic en **"Conectar con Google Drive"**
3. Autoriza el acceso → el vault se sube cifrado a tu Google Drive

Desde ese momento, en cualquier dispositivo nuevo solo tienes que ir a la app → **"Restaurar desde tu nube"** → elegir Google Drive → ingresar tu contraseña maestra → listo.

> El archivo en Google Drive es un blob cifrado — ni Google ni nosotros podemos leerlo.

---

## Las funciones que más vas a usar

| Función | Dónde encontrarla |
|---------|------------------|
| **Ver/copiar una contraseña** | Vault → pasa el mouse sobre la credencial → 📋 |
| **Agregar credencial** | Botón **+ Nueva** en el vault |
| **Generar contraseña segura** | Botón **⚡** al crear/editar, o menú **Generar** |
| **Autocompletado** | Ícono 🔐 en cualquier campo de contraseña (Extensión Chrome) |
| **Ver si tienes contraseñas débiles** | Vault → **Health** |
| **Bloquear la app** | Botón **Bloquear** (o se bloquea solo por inactividad) |

---

## ¿Tienes la app en Chrome y quieres llevarla a otro dispositivo?

1. En el nuevo dispositivo, abre `dpm.dacmosgroup.co`
2. Clic en **"Restaurar desde tu nube"**
3. Elige **Google Drive** y autoriza
4. Ingresa tu contraseña maestra
5. Tu vault aparece completo en el nuevo dispositivo

---

## Preguntas frecuentes

**¿Mis contraseñas están en algún servidor?**
No. El cifrado ocurre en tu dispositivo. El vault en Google Drive es un archivo opaco — sin tu contraseña maestra no se puede abrir.

**¿Por qué tarda un segundo al desbloquear?**
Es intencional — hace prácticamente imposible los ataques de fuerza bruta.

**¿Funciona sin internet?**
Sí, completamente offline. Solo necesitas conexión para sincronizar.

**¿Puedo importar mis contraseñas desde Chrome, Bitwarden o LastPass?**
Sí. Config → Backup → "Importar desde gestor externo" → sube el CSV exportado desde tu gestor actual.

---

## ¿Algo no funciona?

Escríbenos a **dacmosgroup@gmail.com** o abre un issue en:
`github.com/DacmosGroup/dacmosgroup-password-manager`

---

**Guía completa de funciones:** `github.com/DacmosGroup/dacmosgroup-password-manager/blob/main/docs/guia-usuario.md`

---

*DacmosGroup.co — Tecnología compleja, explicada de forma simple.*
*Datos · Nube · Movilidad · Seguridad*
