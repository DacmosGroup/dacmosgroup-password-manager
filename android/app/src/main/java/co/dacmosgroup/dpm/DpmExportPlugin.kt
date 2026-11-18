package co.dacmosgroup.dpm

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * DpmExportPlugin — guarda un archivo elegido por el usuario (EX-1, D1-10).
 *
 * Separado de DpmKeyPlugin a propósito: este plugin solo hace E/S de archivos y no
 * toca el Keystore, así que una revisión del plugin de claves no tiene que revisar esto.
 *
 * Usa el selector "Guardar como" del sistema (Storage Access Framework,
 * ACTION_CREATE_DOCUMENT): el usuario elige carpeta y nombre; no hace falta ningún
 * permiso de almacenamiento y no queda copia intermedia en la app.
 *
 * API expuesta a JS:
 *   guardarArchivo({ nombre, mimeType, contenido })
 *     → { guardado: true }    escrito en el destino elegido
 *     → { guardado: false }   el usuario canceló el selector (no es error)
 *     → reject EXPORT_MIME_NO_PERMITIDO | EXPORT_ESCRITURA_FALLIDA
 *
 * Reglas (contrato D1-10, no negociable):
 *   - Solo escritura: sin método de lectura, sin parámetro de ruta, sin devolver la URI a JS.
 *   - mimeType con lista blanca de 2 valores.
 *   - OutputStream en modo "wt" (truncar), cerrado siempre (use {} = finally).
 *   - Nunca registrar `contenido` en Logcat (ni en debug): este archivo no registra nada.
 */
@CapacitorPlugin(name = "DpmExport")
class DpmExportPlugin : Plugin() {

    companion object {
        private val MIME_PERMITIDOS = setOf("application/json", "text/csv")
        private const val NOMBRE_MAX = 100
        private const val NOMBRE_POR_DEFECTO = "dacmos-export"
    }

    @PluginMethod
    fun guardarArchivo(call: PluginCall) {
        val mimeType = call.getString("mimeType")
        if (mimeType == null || mimeType !in MIME_PERMITIDOS) {
            call.reject("EXPORT_MIME_NO_PERMITIDO", "EXPORT_MIME_NO_PERMITIDO")
            return
        }
        // Sin contenido no hay nada que escribir: se trata como escritura fallida
        // (el contrato solo admite dos códigos de error).
        if (call.getString("contenido") == null) {
            call.reject("EXPORT_ESCRITURA_FALLIDA", "EXPORT_ESCRITURA_FALLIDA")
            return
        }

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType
            // El nombre es solo una sugerencia para el selector; el usuario puede cambiarlo.
            putExtra(Intent.EXTRA_TITLE, sanearNombre(call.getString("nombre")))
        }
        // Capacitor guarda la llamada (con su contenido) hasta que vuelve el selector.
        startActivityForResult(call, intent, "alElegirDestino")
    }

    @ActivityCallback
    private fun alElegirDestino(call: PluginCall?, result: ActivityResult) {
        if (call == null) return

        if (result.resultCode != Activity.RESULT_OK) {
            call.resolve(JSObject().put("guardado", false))
            return
        }
        val uri = result.data?.data
        val contenido = call.getString("contenido")
        if (uri == null || contenido == null) {
            call.reject("EXPORT_ESCRITURA_FALLIDA", "EXPORT_ESCRITURA_FALLIDA")
            return
        }

        try {
            val stream = context.contentResolver.openOutputStream(uri, "wt")
                ?: throw IllegalStateException()
            stream.use { it.write(contenido.toByteArray(Charsets.UTF_8)) }
            call.resolve(JSObject().put("guardado", true))
        } catch (_: Exception) {
            // Sin registrar el detalle: la excepción podría citar la URI o el destino.
            call.reject("EXPORT_ESCRITURA_FALLIDA", "EXPORT_ESCRITURA_FALLIDA")
        }
    }

    /** Quita separadores de ruta y caracteres de control, y limita el largo. */
    private fun sanearNombre(nombre: String?): String {
        val limpio = (nombre ?: "")
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_")
            .trim()
            .take(NOMBRE_MAX)
        return limpio.ifEmpty { NOMBRE_POR_DEFECTO }
    }
}
