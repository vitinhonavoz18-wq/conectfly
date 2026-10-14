package expo.modules.jarvisdevice

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.speech.SpeechRecognizer
import android.view.KeyEvent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Resultado padronizado devolvido ao JavaScript (status do contrato de ações). */
internal fun result(status: String, message: String, code: String? = null, data: Map<String, Any?>? = null): Map<String, Any?> =
  mapOf("status" to status, "message" to message, "code" to code, "data" to data)

/**
 * Ações locais por intents oficiais do Android.
 * Nenhuma função aqui executa comando de shell ou código recebido de fora.
 */
class JarvisDeviceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JarvisDevice")

    AsyncFunction("listLaunchableApps") {
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val list = if (Build.VERSION.SDK_INT >= 33) {
        pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(intent, 0)
      }
      list
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { it.first != context.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
        .map { mapOf("packageName" to it.first, "label" to it.second) }
    }

    AsyncFunction("launchApp") { packageName: String ->
      val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: return@AsyncFunction result("unavailable", "Aplicativo não instalado ou sem tela inicial.", "app_not_installed")
      start(intent)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openUrl") { url: String ->
      val uri = Uri.parse(url)
      // Defesa em profundidade: o JS já valida, o nativo confere de novo.
      if (uri.scheme != "https" && uri.scheme != "http") {
        return@AsyncFunction result("refused", "Somente links http ou https.", "invalid_action")
      }
      start(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openSettings") { panel: String ->
      val pkgUri = Uri.fromParts("package", context.packageName, null)
      val intent = when (panel) {
        "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
        "wifi" -> Intent(Settings.ACTION_WIFI_SETTINGS)
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        "sound" -> Intent(Settings.ACTION_SOUND_SETTINGS)
        "display" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
        "battery" -> Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
        "notifications" -> if (Build.VERSION.SDK_INT >= 26) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri)
        }
        "app_details" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri)
        "general" -> Intent(Settings.ACTION_SETTINGS)
        else -> return@AsyncFunction result("refused", "Painel de configurações desconhecido.", "invalid_action")
      }
      val r = start(intent)
      if (r["status"] != "completed" && panel != "general") start(Intent(Settings.ACTION_SETTINGS)) + mapOf(
        "message" to "Este aparelho não tem atalho direto; abri as configurações gerais."
      ) else r
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openMap") { address: String ->
      val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(address)))
      if (geo.resolveActivity(context.packageManager) != null) {
        start(geo)
      } else {
        start(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=" + Uri.encode(address))))
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openDialer") { phone: String ->
      // ACTION_DIAL só preenche o número; quem decide ligar é o usuário.
      val clean = phone.filter { it.isDigit() || it == '+' || it == '*' || it == '#' }
      start(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(clean))))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("shareText") { text: String ->
      val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
      start(Intent.createChooser(send, "Compartilhar com…"))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("mediaControl") { command: String ->
      val code = when (command) {
        "play_pause" -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
        "play" -> KeyEvent.KEYCODE_MEDIA_PLAY
        "pause" -> KeyEvent.KEYCODE_MEDIA_PAUSE
        "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
        "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
        "stop" -> KeyEvent.KEYCODE_MEDIA_STOP
        else -> return@AsyncFunction result("refused", "Comando de mídia desconhecido.", "invalid_action")
      }
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val activeBefore = audio.isMusicActive
      val now = SystemClock.uptimeMillis()
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0))
      audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0))
      // O Android não informa se o player obedeceu; deixamos isso explícito.
      result(
        "completed",
        if (activeBefore || command == "play" || command == "play_pause") "Comando enviado ao player de mídia ativo."
        else "Comando enviado, mas nenhum áudio parecia estar tocando.",
        data = mapOf("musicActiveBefore" to activeBefore)
      )
    }

    AsyncFunction("getPermissionStatus") {
      val ctx = context
      fun granted(p: String) = ctx.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
      mapOf(
        "sdkInt" to Build.VERSION.SDK_INT,
        "microphone" to granted(Manifest.permission.RECORD_AUDIO),
        "bluetoothConnect" to (if (Build.VERSION.SDK_INT >= 31) granted(Manifest.permission.BLUETOOTH_CONNECT) else true),
        "accessibilityEnabled" to JarvisAccessibilityService.isEnabledInSettings(ctx),
        "accessibilityConnected" to (JarvisAccessibilityService.instance != null),
        "speechRecognitionAvailable" to SpeechRecognizer.isRecognitionAvailable(ctx),
        "onDeviceRecognitionAvailable" to (if (Build.VERSION.SDK_INT >= 31) SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) else false)
      )
    }
  }

  private fun start(intent: Intent): Map<String, Any?> {
    val activity = appContext.currentActivity
    return try {
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
      result("completed", "Aberto.")
    } catch (e: ActivityNotFoundException) {
      result("unavailable", "Nenhum aplicativo neste aparelho consegue abrir isso.", "not_supported")
    } catch (e: SecurityException) {
      result("refused", "O Android bloqueou esta abertura.", "permission_missing")
    }
  }
}
