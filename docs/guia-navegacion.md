# 🧭 Guía de Navegación — Dacmos Password Manager

**Versión 0.3.1 · Mayo 2026**
**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

> Este documento describe cómo moverte dentro de la extensión:
> qué hace cada pantalla, cómo se accede a ella y cómo regresar.
> Es el complemento práctico de la Guía de Usuario.

---

## Mapa general de navegación

```
[Ícono en barra de Chrome]
        │
        ▼
┌─────────────────────┐
│       POPUP         │  ← Punto de entrada siempre
│  Bloqueado /        │
│  Desbloqueado       │
└──────────┬──────────┘
           │
     ┌─────┼──────────────────────┐
     ▼     ▼                      ▼
  [Vault] [Generar]   [Config]  [Bloquear]
           
  Desde Vault:
     └──► [Health]
     └──► [+ Nueva Credencial] (modal)
```

---

## 1. Popup — El punto de entrada

El Popup es la ventana flotante que aparece al hacer clic en el ícono
🔐 de DacmosGroup en la barra de Chrome. **Siempre es el punto de entrada.**

### Estado: Bloqueado

```
┌──────────────────────────┐
│ 🔐 DacmosGroup    ● Bloqueado
│    Password Manager      │
│                          │
│  Ingresa tu contraseña   │
│  maestra                 │
│  ┌────────────────────┐  │
│  │ Contraseña maestra │  │
│  └────────────────────┘  │
│  [     Desbloquear     ] │
│                          │
│ DacmosGroup.com · Zero-Knowledge · AES-256-GCM
└──────────────────────────┘
```

**Qué hacer:** ingresa tu contraseña maestra y presiona **Desbloquear**.

> 💡 El badge rojo **● Bloqueado** en la esquina superior derecha indica
> que el vault está protegido. Ninguna credencial es accesible en este estado.

---

### Estado: Desbloqueado

```
┌──────────────────────────┐
│ 🔐 DacmosGroup    ● Desbloqueado
│    Password Manager      │
│                          │
│  ┌──────────┐ ┌────────┐ │
│  │ Mi Vault │ │Agregar │ │
│  │    N     │ │   +    │ │
│  │credencial│ │ Nueva  │ │
│  └──────────┘ └────────┘ │
│                          │
│  ✅ Sincronizado hace Xm │
│                          │
│  [Vault][Generar][Config][Bloquear]
└──────────────────────────┘
```

**Elementos disponibles:**

| Elemento | Acción |
|----------|--------|
| **Mi Vault** | Abre el vault completo en pestaña nueva |
| **Agregar** | Abre el vault con el modal de nueva credencial |
| **Indicador sync** | Muestra el estado de sincronización |
| **Vault** (barra) | Igual que Mi Vault |
| **Generar** (barra) | Abre el generador de contraseñas en pestaña nueva |
| **Config** (barra) | Abre la configuración en pestaña nueva |
| **Bloquear** (barra) | Bloquea el vault inmediatamente |

> ⚠️ **Comportamiento importante:** Mi Vault, Generar y Config abren
> **pestañas nuevas**. El popup se cierra al hacer clic fuera de él.
> Para volver al popup después, haz clic nuevamente en el ícono 🔐
> de la barra de Chrome. El vault permanece desbloqueado.

---

## 2. Vault Bloqueado — Pantalla de acceso directo

Si intentas acceder al vault directamente (por URL o marcador) con el
vault bloqueado, verás esta pantalla en lugar de las credenciales:

```
        🔒
   Vault Bloqueado
   Ingresa tu contraseña
   maestra para acceder
   ┌─────────────────────┐
   │ ••••••••••••••••••• │
   └─────────────────────┘
   [   Desbloquear Vault  ]
```

**Qué hacer:** ingresa tu contraseña maestra. Una vez desbloqueado,
verás el vault con tus credenciales automáticamente.

---

## 3. Mi Vault — Gestión de credenciales

La vista principal de gestión. Se abre en **pestaña completa**.

```
┌─────────────────────────────────────────────────────┐
│ 🔐 DacmosGroup  ← Inicio          [Health] [+ Nueva]│
│    Mi Vault                                         │
├─────────────────────────────────────────────────────┤
│ 🔍 Buscar credenciales...              3 de 3       │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐   │
│ │ 🔵 Gmail                                      │   │
│ │    dacmosgroup@gmail.com                      │   │
│ │    Modificado: 10 may 2026                    │   │
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ ⚫ GitHub                                     │   │
│ │    dacmosgroup@gmail.com                      │   │
│ │    Modificado: 10 may 2026                    │   │
│ │  [2FA] 654 665  ════════  14s  [📋]           │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Elementos del header:**

| Elemento | Posición | Acción |
|----------|----------|--------|
| **← Inicio** | Izquierda | Cierra esta pestaña — regresa al contexto anterior |
| **Health** | Derecha | Abre el reporte de salud en pestaña nueva |
| **+ Nueva** | Derecha | Abre el modal de nueva credencial |

**Cards de credenciales:**

Cada card muestra nombre del sitio, usuario y fecha de modificación.
Al pasar el mouse aparecen los botones de acción: copiar 📋, editar ✏️, eliminar 🗑️.

**Badge TOTP (2FA):**
Las credenciales con autenticador muestran el código de 6 dígitos en tiempo real,
una barra de progreso y la cuenta regresiva en segundos. El botón 📋 copia
el código al portapapeles con un solo clic.

**Buscador:**
Filtra en tiempo real por nombre del sitio, usuario o URL.
El contador derecho muestra cuántas credenciales coinciden.

---

## 4. Nueva Credencial — Modal

Se abre desde **+ Nueva** en el Vault o desde **Agregar** en el Popup.
Aparece como modal sobre el vault (no abre pestaña nueva).

```
┌─────────────────────────────────────┐
│ ✏️ Nueva Credencial              [X] │
├──────────────────────────────────────┤
│ [🔐 Login] [💳 Tarjeta] [👤 Identidad]│
├──────────────────────────────────────┤
│ SITIO / SERVICIO *                   │
│ ┌──────────────────────────────────┐ │
│ │ ej. Gmail, Netflix, GitHub       │ │
│ └──────────────────────────────────┘ │
│ URL (OPCIONAL)                       │
│ USUARIO / EMAIL *                    │
│ CONTRASEÑA *              [👁] [⚡]   │
│ NOTAS (OPCIONAL)                     │
│ CLAVE TOTP (2FA) — OPCIONAL [👁]     │
├──────────────────────────────────────┤
│              [Cancelar] [Guardar]    │
└──────────────────────────────────────┘
```

**Tres tipos de credencial** — seleccionables por tabs:
- **Login** — usuario + contraseña + TOTP opcional
- **Tarjeta** — datos de tarjeta de crédito/débito
- **Identidad** — datos personales para formularios de registro

**Botones especiales en el campo contraseña:**
- 👁 — revelar/ocultar contraseña
- ⚡ — generar contraseña segura automáticamente (abre el generador inline)

**Cerrar el modal:** clic en **Cancelar**, en la **X** o presiona **Escape**.
El vault de fondo permanece visible e intacto.

---

## 5. Password Health — Reporte de salud

Abre desde el botón **Health** en el vault. Se abre en **pestaña completa**.

```
┌─────────────────────────────────────────────────────┐
│ 🔐 DacmosGroup                          [← Inicio] │
│    Password Health                                  │
├─────────────────────────────────────────────────────┤
│ ✅ Verificación completada. Resultados actualizados. │
├───────────┬──────────┬────────────┬─────────────────┤
│     3     │    0     │     0      │        0        │
│  SEGURAS  │ DÉBILES  │REUTILIZADAS│  COMPROMETIDAS  │
├─────────────────────────────────────────────────────┤
│ Detalle por credencial                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Gmail · dacmosgroup@gmail.com                   │ │
│ │ ✅ Sin problemas detectados                     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Métricas del dashboard:**

| Métrica | Descripción |
|---------|-------------|
| **Seguras** | Contraseñas únicas y con entropía suficiente |
| **Débiles** | Contraseñas cortas o con baja entropía |
| **Reutilizadas** | Mismo password en más de un sitio |
| **Comprometidas** | Aparecen en filtraciones vía HIBP k-anonymity |

> 🔒 **Zero-Knowledge en HIBP:** la contraseña nunca se envía completa.
> Solo se envían los primeros 5 caracteres de su hash SHA-1. El servidor
> devuelve los hashes coincidentes y la comparación ocurre localmente.

**Navegación desde Health:**
- **← Inicio** (esquina superior derecha) — cierra esta pestaña

---

## 6. Generador de Contraseñas

Abre desde **Generar** en el popup. Se abre en **pestaña completa**.

```
┌─────────────────────────────────────────────────────┐
│ 🔐 DacmosGroup                          [← Inicio] │
│    Generador de Contraseñas                         │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────┐ [📋] [🔄]    │
│ │ 9<f[+M_eQ>u42u$z                 │               │
│ └───────────────────────────────────┘               │
│ ████████████████████████  Excelente  103 bits       │
├─────────────────────────────────────────────────────┤
│ ⚙️ Opciones                                         │
│ Longitud  16 ────────────────────── 64              │
│ Mayúsculas (A-Z)                    🔵              │
│ Minúsculas (a-z)                    🔵              │
│ Números (0-9)                       🔵              │
│ Símbolos (!@#$...)                  🔵              │
│ Excluir caracteres ambiguos         ⚪              │
│ [⚡ Generar Contraseña]                             │
├─────────────────────────────────────────────────────┤
│ 🕐 Historial reciente              [Limpiar]        │
│ 9u42u$z                    22:24   [📋]             │
└─────────────────────────────────────────────────────┘
```

**Indicador de calidad:**

| Nivel | Entropía aproximada |
|-------|-------------------|
| Muy débil | < 40 bits |
| Débil | 40–59 bits |
| Regular | 60–79 bits |
| Fuerte | 80–99 bits |
| Muy fuerte | 100–119 bits |
| **Excelente** | **120+ bits** ← objetivo recomendado |

**Historial:** guarda las últimas 5 contraseñas generadas en la sesión.
Se limpia al cerrar la pestaña o con el botón **Limpiar**.

**Navegación:**
- **← Inicio** (esquina superior derecha) — cierra esta pestaña

---

## 7. Configuración

Abre desde **Config** en el popup. Se abre en **pestaña completa**.

**Secciones disponibles:**

| Sección | Qué configuras |
|---------|---------------|
| **Contraseña Maestra** | Cambiar la contraseña maestra |
| **Bloqueo automático** | Tiempo de inactividad antes de bloquear |
| **Portapapeles** | Tiempo antes de limpiar contraseña copiada |
| **Backup del Vault** | Exportar e importar el vault cifrado |
| **Sincronización** | Conectar Google Drive u OneDrive |
| **Modelo de Seguridad** | Información técnica y versión actual |

**Recomendaciones de configuración:**

| Parámetro | Valor recomendado | Motivo |
|-----------|------------------|--------|
| Bloqueo automático | 5 minutos | Balance seguridad/comodidad |
| Limpiar portapapeles | 30 segundos | Evita exposición accidental |
| Backup | Semanal | Prevenir pérdida de datos |

> ⚠️ Un tiempo de bloqueo muy corto (1 minuto) puede bloquear el vault
> mientras navegas entre pestañas, lo que interrumpe el autocompletado.

**Navegación:**
- **← Inicio** (esquina superior derecha) — cierra esta pestaña

---

## 8. Comportamiento del botón ← Inicio

Este botón aparece en el header de todas las vistas de pestaña completa.

| Vista | Comportamiento de ← Inicio |
|-------|---------------------------|
| **Vault** | Cierra la pestaña del vault |
| **Health** | Cierra la pestaña de Health |
| **Generator** | Cierra la pestaña del generador |
| **Settings** | Cierra la pestaña de configuración |

**Flujo típico:**
1. Haces clic en el ícono 🔐 → se abre el Popup
2. Seleccionas **Mi Vault** → se abre el Vault en pestaña nueva
3. Haces clic en **← Inicio** → la pestaña del Vault se cierra
4. Haces clic en el ícono 🔐 nuevamente → el Popup vuelve a aparecer
5. El vault **permanece desbloqueado** — no necesitas ingresar la contraseña de nuevo

> 💡 ← Inicio no es "atrás" — es "salir de esta vista". El vault no se
> bloquea al cerrar la pestaña. Solo se bloquea por inactividad (autolock),
> al hacer clic en **Bloquear** desde el popup, o al cerrar Chrome.

---

## 9. Flujos de navegación más comunes

### Flujo A — Consultar una contraseña

```
Clic en ícono 🔐
    → Popup (desbloqueado)
    → Mi Vault
    → Buscar credencial
    → Copiar 📋
    → ← Inicio (cierra el vault)
    → Clic en ícono 🔐 (reabre popup)
```

### Flujo B — Agregar una credencial nueva

```
Clic en ícono 🔐
    → Popup → Agregar
    → Modal Nueva Credencial
    → Llenar campos
    → ⚡ Generar contraseña (opcional)
    → Guardar
    → Modal se cierra
    → Vault muestra la nueva credencial
```

### Flujo C — Verificar seguridad del vault

```
Clic en ícono 🔐
    → Popup → Mi Vault
    → Vault → Health
    → Revisar métricas
    → ← Inicio (cierra Health)
    → Regresa a... nada (la pestaña de Health se cerró)
    → Clic en ícono 🔐 → Popup nuevamente
```

### Flujo D — Autocompletado en un sitio web

```
Navegar a cualquier sitio con formulario de login
    → Asegurarse de que el vault esté desbloqueado
    → Hacer clic en el ícono 🔐 dentro del campo password
    → Seleccionar la credencial del selector
    → Campos llenados automáticamente
    → Clic en el botón de login del sitio
```

> ⚠️ Si aparece "No hay credenciales guardadas para este formulario",
> lo más probable es que el vault se bloqueó. Abre el popup, desbloquea,
> y vuelve a hacer clic en el ícono 🔐 del formulario.

---

## 10. Referencia rápida de atajos

| Acción | Cómo hacerlo |
|--------|-------------|
| Abrir la extensión | Clic en ícono 🔐 en la barra de Chrome |
| Desbloquear | Popup → ingresar contraseña maestra → Desbloquear |
| Abrir vault | Popup → Mi Vault (o tab Vault en la barra inferior) |
| Nueva credencial | Popup → Agregar, o Vault → + Nueva |
| Copiar contraseña | Hover sobre credencial → 📋 |
| Generar contraseña | Popup → Generar (barra inferior) |
| Verificar salud | Vault → Health |
| Configurar | Popup → Config (barra inferior) |
| Bloquear manualmente | Popup → Bloquear (barra inferior) |
| Volver desde cualquier vista | Botón ← Inicio (esquina superior) |

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
>
> Versión del documento: 0.3.1 · Mayo 2026
