// ================================================
// Dacmos Password Manager — Wizard de Importación CSV
// F1.1: Importar credenciales desde gestores externos
//
// Coordina el flujo completo:
//   csv-importer.js → deduplicación → preview → vault cifrado
//
// Depende de:
//   ../../import/csv-importer.js  — parseo y normalización (sin efectos)
//   ../../crypto/engine.js        — API pública del vault cifrado
// ================================================

import {
  desbloquearVault,
  cargarVaultDescifrado,
  guardarVaultCifrado,
} from '../../crypto/engine.js';

import {
  parsearCSV,
  detectarFormato,
  normalizarCredenciales,
  FORMATOS,
} from '../../import/csv-importer.js';

// ── Estado interno del wizard ──
// Solo vive en memoria durante el flujo activo; se limpia en cancelarImportacion()
let _filasCSV       = null;  // Filas crudas del CSV parseado
let _formatoActual  = null;  // Clave del formato activo ('google'|'bitwarden'|…)
let _credAImportar  = [];    // Credenciales nuevas tras deduplicación
let _credDuplicadas = [];    // Credenciales ignoradas por URL+usuario repetido
let _claveSesion    = null;  // Clave AES derivada — se libera en cuanto termina la escritura

// ── Referencias al DOM ──
// Resueltas en inicializarWizardImport() para garantizar que el DOM ya fue parseado.
let elBtnAbrir, elPanel, elInputArchivo;
let elGrupoFormato, elBadgeFormato, elSelectFormato;
let elGrupoPassword, elInputPassword, elBtnTogglePass, elBtnPrevisualizar;
let elErrorMsg, elPanelPreview, elResumen, elTbody;
let elBtnCancelar, elBtnConfirmar, elSuccessMsg;

// ── Punto de entrada — llamado desde settings.js ──
// Registra todos los event listeners del wizard.
function inicializarWizardImport() {
  elBtnAbrir         = document.getElementById('btnAbrirImportarCSV');
  elPanel            = document.getElementById('panelImportarCSV');
  elInputArchivo     = document.getElementById('inputArchivoCSV');
  elGrupoFormato     = document.getElementById('grupoFormatoCSV');
  elBadgeFormato     = document.getElementById('badgeFormatoCSV');
  elSelectFormato    = document.getElementById('selectFormatoCSV');
  elGrupoPassword    = document.getElementById('grupoPasswordImportCSV');
  elInputPassword    = document.getElementById('inputPasswordImportCSV');
  elBtnTogglePass    = document.getElementById('btnTogglePasswordImportCSV');
  elBtnPrevisualizar = document.getElementById('btnPrevisualizarCSV');
  elErrorMsg         = document.getElementById('errorImportarCSV');
  elPanelPreview     = document.getElementById('panelPreviewCSV');
  elResumen          = document.getElementById('resumenPreviewCSV');
  elTbody            = document.getElementById('tbodyPreviewCSV');
  elBtnCancelar      = document.getElementById('btnCancelarImportarCSV');
  elBtnConfirmar     = document.getElementById('btnConfirmarImportarCSV');
  elSuccessMsg       = document.getElementById('successImportarCSV');

  elBtnAbrir.addEventListener('click',         alternarPanel);
  elInputArchivo.addEventListener('change',    manejarArchivoSeleccionado);
  elSelectFormato.addEventListener('change',   manejarCambioFormatoManual);
  elBtnTogglePass.addEventListener('click',    alternarVisibilidadPassword);
  elBtnPrevisualizar.addEventListener('click', previsualizarImportacion);
  elBtnCancelar.addEventListener('click',      cancelarImportacion);
  elBtnConfirmar.addEventListener('click',     confirmarImportacion);
}

// ── Abrir / cerrar el panel del wizard ──
function alternarPanel() {
  const estaOculto = elPanel.classList.contains('hidden');
  if (estaOculto) {
    resetearWizard();
    elPanel.classList.remove('hidden');
  } else {
    elPanel.classList.add('hidden');
    resetearWizard();
  }
}

// ── Resetear todo el estado del wizard a su condición inicial ──
function resetearWizard() {
  // Limpiar estado interno
  _filasCSV       = null;
  _formatoActual  = null;
  _credAImportar  = [];
  _credDuplicadas = [];
  _claveSesion    = null;  // Liberar clave de memoria

  // Limpiar DOM
  elInputArchivo.value              = '';
  elInputPassword.value             = '';
  elInputPassword.type              = 'password';
  elSelectFormato.value             = '';
  elGrupoFormato.style.display      = 'none';
  elGrupoPassword.style.display     = 'none';
  elPanelPreview.classList.add('hidden');
  elSuccessMsg.classList.add('hidden');
  elErrorMsg.classList.add('hidden');
  elTbody.innerHTML                 = '';
}

// ── PASO 1: El usuario seleccionó un archivo CSV ──
// Parsea el CSV, detecta el formato y muestra el selector de formato + campo de contraseña.
async function manejarArchivoSeleccionado(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  // Colapsar secciones previas al cargar un nuevo archivo
  ocultarError();
  elGrupoFormato.style.display  = 'none';
  elGrupoPassword.style.display = 'none';
  elPanelPreview.classList.add('hidden');
  elSuccessMsg.classList.add('hidden');

  try {
    const texto  = await archivo.text();
    _filasCSV    = parsearCSV(texto);

    if (_filasCSV.length < 2) {
      mostrarError('El archivo CSV está vacío o no contiene filas de datos.');
      return;
    }

    // Detectar formato por fingerprinting de encabezados
    const headers    = _filasCSV[0].map(h => h.trim());
    const detectado  = detectarFormato(headers);
    _formatoActual   = detectado;

    // Mostrar fila de formato detectado / selector manual
    elGrupoFormato.style.display = 'block';

    if (detectado && detectado !== 'generico') {
      // Formato conocido identificado con certeza
      const nombre = FORMATOS[detectado]?.nombre ?? detectado;
      elBadgeFormato.textContent = `✅ Detectado: ${nombre}`;
      elBadgeFormato.className   = 'import-format-badge badge-detected';
      elSelectFormato.value      = detectado;
    } else if (detectado === 'generico') {
      // CSV con columnas reconocibles pero sin fingerprint exacto
      elBadgeFormato.textContent = '⚠️ Formato genérico';
      elBadgeFormato.className   = 'import-format-badge badge-generic';
      elSelectFormato.value      = 'generico';
    } else {
      // No se pudo identificar — pedir selección manual
      elBadgeFormato.textContent = '❓ No detectado — selecciona manualmente';
      elBadgeFormato.className   = 'import-format-badge badge-unknown';
      elSelectFormato.value      = '';
    }

    // Mostrar campo de contraseña para continuar al paso 2
    elGrupoPassword.style.display = 'block';
    elInputPassword.focus();

  } catch (_err) {
    mostrarError('Error al leer el archivo. Verifica que sea un CSV válido y vuelve a intentarlo.');
  }
}

// ── Cambio manual del formato por el usuario ──
// Si el preview ya estaba visible, se oculta para forzar una nueva previsualización.
function manejarCambioFormatoManual(e) {
  _formatoActual = e.target.value || null;
  elPanelPreview.classList.add('hidden');
  ocultarError();
}

// ── Toggle visibilidad de la contraseña maestra ──
function alternarVisibilidadPassword() {
  elInputPassword.type = elInputPassword.type === 'password' ? 'text' : 'password';
}

// ── PASO 2: Previsualizar la importación ──
// Verifica contraseña, deduplica contra el vault actual y renderiza la tabla de preview.
async function previsualizarImportacion() {
  ocultarError();
  elPanelPreview.classList.add('hidden');

  const password = elInputPassword.value;
  if (!password)       { mostrarError('Ingresa tu contraseña maestra para continuar.'); return; }
  if (!_formatoActual) { mostrarError('Selecciona el formato del archivo CSV.'); return; }
  if (!_filasCSV || _filasCSV.length < 2) { mostrarError('No hay datos para importar.'); return; }

  elBtnPrevisualizar.textContent = 'Analizando...';
  elBtnPrevisualizar.disabled    = true;

  try {
    // Verificar contraseña y obtener clave AES en memoria
    _claveSesion = await desbloquearVault(password);
    if (!_claveSesion) {
      mostrarError('Contraseña maestra incorrecta.');
      return;
    }

    // Normalizar credenciales del CSV al esquema interno
    const candidatas = normalizarCredenciales(_filasCSV, _formatoActual);
    if (candidatas.length === 0) {
      mostrarError('No se encontraron credenciales válidas en el archivo. Verifica el formato seleccionado.');
      return;
    }

    // Cargar vault actual para construir el Set de deduplicación
    const credActuales     = await cargarVaultDescifrado(_claveSesion);
    const clavesExistentes = new Set(credActuales.map(claveDedup));

    // Separar nuevas de duplicadas (comparación URL+usuario normalizado)
    _credAImportar  = candidatas.filter(c => !clavesExistentes.has(claveDedup(c)));
    _credDuplicadas = candidatas.filter(c =>  clavesExistentes.has(claveDedup(c)));

    // Renderizar tabla de preview
    renderizarPreview(candidatas);

    // Actualizar texto del botón según la cantidad de nuevas
    if (_credAImportar.length > 0) {
      const s = _credAImportar.length !== 1 ? 'es' : '';
      elBtnConfirmar.textContent = `Importar ${_credAImportar.length} credencial${s}`;
      elBtnConfirmar.disabled    = false;
    } else {
      elBtnConfirmar.textContent = 'Sin credenciales nuevas';
      elBtnConfirmar.disabled    = true;
    }

    elPanelPreview.classList.remove('hidden');

  } catch (_err) {
    mostrarError('Error al analizar el archivo. Intenta de nuevo.');
  } finally {
    elBtnPrevisualizar.textContent = 'Previsualizar importación';
    elBtnPrevisualizar.disabled    = false;
  }
}

// ── Renderizar tabla de preview ──
// Muestra hasta MAX_PREVIEW filas para no saturar el DOM con archivos grandes.
function renderizarPreview(candidatas) {
  const MAX_PREVIEW = 200;

  // Resumen numérico
  elResumen.innerHTML = `
    <span class="resumen-nuevas">✅ ${_credAImportar.length} nueva${_credAImportar.length !== 1 ? 's' : ''}</span>
    <span class="resumen-sep">·</span>
    <span class="resumen-dup">⊘ ${_credDuplicadas.length} duplicada${_credDuplicadas.length !== 1 ? 's' : ''} (se ignorarán)</span>
  `;

  // Set para lookup rápido al colorear filas
  const clavesNuevas = new Set(_credAImportar.map(claveDedup));

  const mostrar  = candidatas.slice(0, MAX_PREVIEW);
  const omitidas = candidatas.length - mostrar.length;

  elTbody.innerHTML = '';

  for (const cred of mostrar) {
    const esNueva = clavesNuevas.has(claveDedup(cred));
    const tr      = document.createElement('tr');
    tr.className  = esNueva ? 'fila-nueva' : 'fila-duplicada';

    // La contraseña siempre se muestra enmascarada — nunca en texto plano en el DOM
    tr.innerHTML = `
      <td>${escapeHtml(cred.sitio)}</td>
      <td class="url-cell" title="${escapeHtml(cred.url)}">${escapeHtml(cred.url)}</td>
      <td>${escapeHtml(cred.usuario)}</td>
      <td class="password-mask">••••••••</td>
      <td>${esNueva
        ? '<span class="badge-nueva">Nueva</span>'
        : '<span class="badge-dup">Duplicada</span>'
      }</td>
    `;
    elTbody.appendChild(tr);
  }

  // Nota de truncado si el archivo supera el límite del preview
  if (omitidas > 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="5" class="preview-truncado">
        ... y ${omitidas} credencial${omitidas !== 1 ? 'es' : ''} más (no mostrada${omitidas !== 1 ? 's' : ''} en preview)
      </td>
    `;
    elTbody.appendChild(tr);
  }
}

// ── PASO 3: Confirmar e importar al vault cifrado ──
async function confirmarImportacion() {
  if (_credAImportar.length === 0) return;

  if (!_claveSesion) {
    mostrarError('La sesión expiró. Vuelve a previsualizar para continuar.');
    return;
  }

  ocultarError();
  elBtnConfirmar.textContent = 'Importando...';
  elBtnConfirmar.disabled    = true;
  elBtnCancelar.disabled     = true;

  try {
    // Recargar vault en el momento de la escritura — el vault puede haber
    // cambiado en otra pestaña entre el preview y la confirmación.
    const credActuales     = await cargarVaultDescifrado(_claveSesion);
    const clavesExistentes = new Set(credActuales.map(claveDedup));

    // Re-filtrar por si aparecieron duplicados nuevos desde el preview
    const credFinales = _credAImportar.filter(c => !clavesExistentes.has(claveDedup(c)));

    // Asignar ID único y timestamps a cada credencial importada
    const ahora  = new Date().toISOString();
    const nuevas = credFinales.map(c => ({
      id:         crypto.randomUUID(),
      sitio:      c.sitio,
      url:        c.url,
      usuario:    c.usuario,
      password:   c.password,
      notas:      c.notas || '',
      creado:     ahora,
      modificado: ahora,
    }));

    // Escribir vault cifrado con las credenciales combinadas
    await guardarVaultCifrado([...credActuales, ...nuevas], _claveSesion);

  } catch (_err) {
    mostrarError('Error al importar. Intenta de nuevo.');
    elBtnCancelar.disabled = false;
    // Restaurar texto del botón con el conteo original
    const s = _credAImportar.length !== 1 ? 'es' : '';
    elBtnConfirmar.textContent = `Importar ${_credAImportar.length} credencial${s}`;
    elBtnConfirmar.disabled    = false;
    return;
  } finally {
    // Liberar la clave AES de memoria lo antes posible,
    // independientemente de si la escritura fue exitosa o no.
    _claveSesion = null;
  }

  // ── Éxito: mostrar reporte y cerrar panel ──
  const importadas = nuevas.length;
  const ignoradas  = _credDuplicadas.length;

  let msg = importadas === 1
    ? '✅ 1 credencial importada correctamente.'
    : `✅ ${importadas} credenciales importadas correctamente.`;

  if (ignoradas > 0) {
    msg += ` ${ignoradas} duplicada${ignoradas !== 1 ? 's' : ''} ignorada${ignoradas !== 1 ? 's' : ''}.`;
  }

  elSuccessMsg.textContent = msg;
  elSuccessMsg.classList.remove('hidden');
  elPanelPreview.classList.add('hidden');
  elGrupoPassword.style.display = 'none';
  elGrupoFormato.style.display  = 'none';

  // Cerrar el panel automáticamente tras 4 segundos
  setTimeout(() => {
    elPanel.classList.add('hidden');
    resetearWizard();
  }, 4000);
}

// ── Cancelar: cerrar y limpiar ──
function cancelarImportacion() {
  _claveSesion = null; // Liberar clave de memoria inmediatamente
  elPanel.classList.add('hidden');
  resetearWizard();
}

// ── Clave canónica de deduplicación URL + usuario ──
// Normaliza: minúsculas, trailing slash eliminado, espacios recortados.
// Una credencial existente y una candidata son duplicados si sus claves coinciden.
function claveDedup(cred) {
  const url = (cred.url || '').toLowerCase().replace(/\/+$/, '').trim();
  const usr = (cred.usuario || '').toLowerCase().trim();
  return `${url}|${usr}`;
}

// ── Escape de HTML ──
// DECISIÓN DE SEGURIDAD: todos los datos del CSV son no confiables.
// Se escapan antes de insertarse en el DOM para prevenir XSS.
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

// ── Helpers de mensajes ──
function mostrarError(mensaje) {
  elErrorMsg.textContent = mensaje;
  elErrorMsg.classList.remove('hidden');
}

function ocultarError() {
  elErrorMsg.classList.add('hidden');
}

export { inicializarWizardImport };
