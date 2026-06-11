# Store Assets — Chrome Web Store (y futuros stores)

Fuente de verdad de los assets visuales del listing. **Todo lo que se sube al
dashboard de CWS debe guardarse aquí primero** — el dashboard no es un backup.

## Estructura

```
docs/cws-assets/
├── README.md                  # Este archivo
├── make-composites.ps1        # Compone capturas crudas → 1280×800 listos para CWS
├── listing/                   # Textos del listing por idioma (summary + description)
│   ├── es.md                  #   Español (principal)
│   ├── en.md                  #   English
│   └── pt_BR.md               #   Português (BR)
└── screenshots/
    └── v0.5.0/                # Capturas crudas (un directorio por versión)
        └── final/             # PNGs 1280×800 generados — ESTOS van al dashboard
```

**Regla del listing:** cualquier cambio de texto se edita PRIMERO en `listing/*.md`
y luego se pega en el dashboard. Los 3 idiomas se actualizan juntos en cada release.

## Especificaciones CWS

| Asset | Tamaño | Formato | Notas |
|---|---|---|---|
| Screenshots (1–5) | **1280×800** o 640×400 | PNG/JPG | Sin barra "Developer mode", sin chrome:// visible |
| Icono del store | 128×128 | PNG | Ya en `src/` del paquete |
| Small promo tile (opcional) | 440×280 | PNG/JPG | — |
| Marquee promo (opcional) | 1400×560 | PNG/JPG | — |

## Reglas

- **Datos siempre ficticios** — nunca entradas, emails ni dominios reales (mandato L0)
- Capturar desde la versión unpacked que corresponde al ZIP que se va a subir
- Numerar con prefijo `01-`, `02-`... → el orden del listing replica el orden de archivo
- Al cambiar el set en el dashboard, crear el directorio de la nueva versión aquí
  ANTES de subir (no sobreescribir el de la versión anterior)

## Set v0.5.0 — estado 2026-06-10

Capturas crudas en `screenshots/v0.5.0/` · finales 1280×800 en `screenshots/v0.5.0/final/`
(generados con `make-composites.ps1` — fondo #0B1423, recorte de toolbar/bordes en popups).

1. `01-popup-home.png` ✅ — popup desbloqueado (Vault / Agregar)
2. `02-vault.png` ✅ — vault con 4 credenciales de la cuenta de pruebas
3. `03-generator.png` ✅ — generador (187 bits de entropía visible)
4. `04-i18n.png` ✅ — ⭐ collage ES (home) · EN (lock) · PT-BR (home). Recordatorio:
   la extensión usa `chrome.i18n` (sigue el idioma de Chrome, sin selector manual —
   el selector es solo de la PWA); capturas tomadas con `chrome.exe --lang=`.
   Mejora opcional futura: popup EN desbloqueado para un collage 100% uniforme
5. `05-sync-byoc.png` ✅ — sync BYOC Google Drive/OneDrive

Suplentes (capturados, no compuestos): Password Health · Backup/Export · Editar credencial.

> Datos de demo: cuenta `carjes2795@gmail.com` creada SOLO para pruebas (sin uso
> personal/negocio) — aceptada 2026-06-10. No borrar ese vault hasta que el listing
> v0.5.0 esté aprobado, por si hay que retomar capturas.

> Nota histórica: los screenshots de v0.4.1 y anteriores nunca se guardaron en el
> repo — viven solo en el dashboard de CWS. Este directorio existe para que no
> vuelva a pasar (2026-06-10).
