package co.dacmosgroup.dpm

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * DpmKeyPlugin — plugin nativo Capacitor para operaciones biométricas de DPM.
 *
 * Implementa el patrón documentado en documento-tecnico.md §5:
 *   wrap_key generada en Android Keystore (hardware-bound)
 *   BiometricPrompt.CryptoObject autoriza encrypt/decrypt
 *   La wrap_key nunca sale del hardware — JS solo ve {iv, ciphertext}
 *
 * API expuesta a JS:
 *   isAvailable()                    → { available: boolean }
 *   wrap({ vaultKey: base64 })       → { iv: base64, ciphertext: base64 }
 *   unwrap({ iv, ciphertext })       → { vaultKey: base64 }
 *   deleteKey()                      → void
 *   wrapToken({ token: string })     → { iv: base64, ciphertext: base64 }
 *   unwrapToken({ iv, ciphertext })  → { token: string }
 *
 * Errores posibles (call.reject primer argumento):
 *   USER_CANCELED         — usuario canceló el prompt
 *   KEY_INVALIDATED       — nueva biometría inscrita, re-setup requerido
 *   BIOMETRIC_UNAVAILABLE — hardware no disponible o sin biometría inscrita
 *   MISSING_PARAM         — parámetro obligatorio ausente
 *   BIOMETRIC_ERROR       — error de autenticación con código del sistema
 */
@CapacitorPlugin(name = "DpmKey")
class DpmKeyPlugin : Plugin() {

    companion object {
        private const val VAULT_KEY_ALIAS   = "dpm_vault_wrap_key"
        private const val TOKEN_KEY_ALIAS   = "dpm_token_wrap_key"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val CIPHER_SPEC       = "AES/GCM/NoPadding"
        private const val GCM_TAG_LEN       = 128
    }

    // ── Availability ──────────────────────────────────────────────────────────

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = BiometricManager.from(context)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        val ret = JSObject()
        ret.put("available", status == BiometricManager.BIOMETRIC_SUCCESS)
        call.resolve(ret)
    }

    // ── Vault key — wrap/unwrap (require biometrics) ──────────────────────────

    @PluginMethod
    fun wrap(call: PluginCall) {
        val vaultKeyB64 = call.getString("vaultKey")
            ?: return call.reject("MISSING_PARAM", "vaultKey is required")
        val vaultKeyBytes = Base64.decode(vaultKeyB64, Base64.NO_WRAP)

        try { ensureKey(VAULT_KEY_ALIAS, requireUserAuth = true) }
        catch (e: Exception) { return call.reject("KEY_GENERATION_FAILED", e.message) }

        val cipher = try {
            initCipher(VAULT_KEY_ALIAS, Cipher.ENCRYPT_MODE)
        } catch (e: KeyPermanentlyInvalidatedException) {
            deleteKeyAlias(VAULT_KEY_ALIAS)
            return call.reject("KEY_INVALIDATED", "Biometric enrollment changed. Please set up biometrics again.")
        } catch (e: Exception) {
            return call.reject("CIPHER_INIT_FAILED", e.message)
        }

        showPrompt(
            call         = call,
            cipher       = cipher,
            title        = "Activar desbloqueo biométrico",
            subtitle     = "Dacmos Password Manager",
            negativeText = "Cancelar",
        ) { c ->
            val ciphertext = c.doFinal(vaultKeyBytes)
            JSObject().apply {
                put("iv",         Base64.encodeToString(c.iv,        Base64.NO_WRAP))
                put("ciphertext", Base64.encodeToString(ciphertext,   Base64.NO_WRAP))
            }
        }
    }

    @PluginMethod
    fun unwrap(call: PluginCall) {
        val iv         = call.getString("iv")
            ?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return call.reject("MISSING_PARAM", "iv is required")
        val ciphertext = call.getString("ciphertext")
            ?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return call.reject("MISSING_PARAM", "ciphertext is required")

        val cipher = try {
            initCipher(VAULT_KEY_ALIAS, Cipher.DECRYPT_MODE, iv)
        } catch (e: KeyPermanentlyInvalidatedException) {
            deleteKeyAlias(VAULT_KEY_ALIAS)
            return call.reject("KEY_INVALIDATED", "Biometric enrollment changed. Master password required.")
        } catch (e: Exception) {
            return call.reject("CIPHER_INIT_FAILED", e.message)
        }

        showPrompt(
            call         = call,
            cipher       = cipher,
            title        = "Desbloquear Dacmos PM",
            subtitle     = "Usa tu huella o reconocimiento facial",
            negativeText = "Usar contraseña",
        ) { c ->
            val plaintext = c.doFinal(ciphertext)
            JSObject().apply {
                put("vaultKey", Base64.encodeToString(plaintext, Base64.NO_WRAP))
            }
        }
    }

    // ── Token — wrap/unwrap (hardware-backed, no biometrics required) ─────────

    @PluginMethod
    fun wrapToken(call: PluginCall) {
        val token = call.getString("token")
            ?: return call.reject("MISSING_PARAM", "token is required")

        try { ensureKey(TOKEN_KEY_ALIAS, requireUserAuth = false) }
        catch (e: Exception) { return call.reject("KEY_GENERATION_FAILED", e.message) }

        try {
            val cipher     = initCipher(TOKEN_KEY_ALIAS, Cipher.ENCRYPT_MODE)
            val ciphertext = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            JSObject().apply {
                put("iv",         Base64.encodeToString(cipher.iv,   Base64.NO_WRAP))
                put("ciphertext", Base64.encodeToString(ciphertext,   Base64.NO_WRAP))
            }.also { call.resolve(it) }
        } catch (e: Exception) {
            call.reject("WRAP_TOKEN_FAILED", e.message)
        }
    }

    @PluginMethod
    fun unwrapToken(call: PluginCall) {
        val iv         = call.getString("iv")
            ?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return call.reject("MISSING_PARAM", "iv is required")
        val ciphertext = call.getString("ciphertext")
            ?.let { Base64.decode(it, Base64.NO_WRAP) }
            ?: return call.reject("MISSING_PARAM", "ciphertext is required")

        try {
            val cipher    = initCipher(TOKEN_KEY_ALIAS, Cipher.DECRYPT_MODE, iv)
            val plaintext = cipher.doFinal(ciphertext)
            JSObject().apply {
                put("token", String(plaintext, Charsets.UTF_8))
            }.also { call.resolve(it) }
        } catch (e: Exception) {
            call.reject("UNWRAP_TOKEN_FAILED", e.message)
        }
    }

    // ── Key lifecycle ─────────────────────────────────────────────────────────

    @PluginMethod
    fun deleteKey(call: PluginCall) {
        deleteKeyAlias(VAULT_KEY_ALIAS)
        call.resolve()
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun ensureKey(alias: String, requireUserAuth: Boolean) {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        if (ks.containsAlias(alias)) return
        generateAesKey(alias, requireUserAuth)
    }

    private fun generateAesKey(alias: String, requireUserAuth: Boolean) {
        val keyGen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)

        fun spec(strongBox: Boolean): KeyGenParameterSpec {
            val b = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(requireUserAuth)

            if (requireUserAuth) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    b.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    b.setInvalidatedByBiometricEnrollment(true)
                }
            }
            if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                b.setIsStrongBoxBacked(true)
            }
            return b.build()
        }

        // Prefer StrongBox (secure enclave) — fall back to TEE on any exception
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                keyGen.init(spec(strongBox = true))
                keyGen.generateKey()
                return
            } catch (_: Exception) { }
        }
        keyGen.init(spec(strongBox = false))
        keyGen.generateKey()
    }

    private fun initCipher(alias: String, mode: Int, iv: ByteArray? = null): Cipher {
        val ks  = KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }
        val key = ks.getKey(alias, null) as SecretKey
        return Cipher.getInstance(CIPHER_SPEC).also { cipher ->
            if (mode == Cipher.DECRYPT_MODE && iv != null) {
                cipher.init(mode, key, GCMParameterSpec(GCM_TAG_LEN, iv))
            } else {
                cipher.init(mode, key)
            }
        }
    }

    private fun deleteKeyAlias(alias: String) {
        KeyStore.getInstance(KEYSTORE_PROVIDER).also { it.load(null) }.run {
            if (containsAlias(alias)) deleteEntry(alias)
        }
    }

    private fun showPrompt(
        call: PluginCall,
        cipher: Cipher,
        title: String,
        subtitle: String,
        negativeText: String,
        onSuccess: (Cipher) -> JSObject,
    ) {
        val fragmentActivity = activity as? FragmentActivity
            ?: return call.reject("ACTIVITY_ERROR", "Activity is not a FragmentActivity")

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeText)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        val executor = ContextCompat.getMainExecutor(context)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val authorizedCipher = result.cryptoObject?.cipher
                    ?: return call.reject("CRYPTO_OBJECT_NULL", "No cipher in CryptoObject")
                try {
                    call.resolve(onSuccess(authorizedCipher))
                } catch (e: Exception) {
                    call.reject("CRYPTO_OP_FAILED", e.message)
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                when (errorCode) {
                    BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                    BiometricPrompt.ERROR_USER_CANCELED -> call.reject("USER_CANCELED")
                    else -> call.reject("BIOMETRIC_ERROR", "$errorCode: $errString")
                }
            }

            // Single attempt failed — BiometricPrompt handles retries automatically
            override fun onAuthenticationFailed() = Unit
        }

        fragmentActivity.runOnUiThread {
            BiometricPrompt(fragmentActivity, executor, callback)
                .authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
        }
    }
}
