package expo.modules.jarvisdevice

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Recursos "sempre ligados": palavra de ativação "Jarvis" e "assistir junto".
 * Cada um exige ação explícita do usuário e mostra notificação fixa.
 */
class JarvisAmbientModule : Module() {
  private var pendingProjection: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JarvisAmbient")

    Events("onWake", "onWakeState", "onWakeError", "onScreenState", "onScreenError")

    OnCreate {
      JarvisBus.listener = { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      JarvisBus.listener = null
    }

    AsyncFunction("getStatus") {
      mapOf(
        "wakeRunning" to JarvisWakeService.running,
        "wakePaused" to JarvisWakeService.paused,
        "screenRunning" to JarvisScreenService.running,
        "notificationsAllowed" to (Build.VERSION.SDK_INT < 33 ||
          context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
      )
    }

    /** Liga a escuta de "Jarvis". Precisa ser chamado com o app aberto na tela. */
    AsyncFunction("startWake") { accessKey: String, sensitivity: Double ->
      val ctx = context
      if (ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        return@AsyncFunction result("refused", "Permita o microfone para o Jarvis ouvir quando for chamado.", "permission_missing")
      }
      if (accessKey.isBlank()) {
        return@AsyncFunction result("refused", "Cole a chave do Picovoice (AccessKey) nas configurações.", "permission_missing")
      }
      val intent = Intent(ctx, JarvisWakeService::class.java)
        .putExtra(JarvisWakeService.EXTRA_KEY, accessKey)
        .putExtra(JarvisWakeService.EXTRA_SENSITIVITY, sensitivity.toFloat())
      try {
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
        result("completed", "Ouvindo \"Jarvis\" em segundo plano.")
      } catch (e: IllegalStateException) {
        // Android 12+: não pode iniciar serviço em primeiro plano com o app minimizado.
        result("refused", "Abra o Jarvis na tela para ligar a escuta.", "not_supported")
      } catch (e: SecurityException) {
        result("refused", "O Android bloqueou a escuta em segundo plano.", "permission_missing")
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopWake") {
      JarvisWakeService.instance?.requestStop()
      true
    }.runOnQueue(Queues.MAIN)

    /** Pausa (enquanto o Jarvis fala/escuta a pergunta) e retoma a espera por "Jarvis". */
    AsyncFunction("pauseWake") {
      JarvisWakeService.instance?.pause()
      JarvisWakeService.instance != null
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("resumeWake") {
      JarvisWakeService.instance?.resume()
      JarvisWakeService.instance != null
    }.runOnQueue(Queues.MAIN)

    /** Mostra o aviso do Android pedindo para capturar a tela. */
    AsyncFunction("startScreenWatch") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(result("unavailable", "Abra o Jarvis na tela para ligar o modo assistir junto.", "not_supported"))
        return@AsyncFunction
      }
      if (JarvisScreenService.running) {
        promise.resolve(result("completed", "O modo assistir junto já está ligado."))
        return@AsyncFunction
      }
      pendingProjection?.resolve(result("cancelled", "Pedido substituído.", "cancelled"))
      pendingProjection = promise
      val mpm = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      @Suppress("DEPRECATION")
      activity.startActivityForResult(mpm.createScreenCaptureIntent(), REQUEST_PROJECTION)
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_PROJECTION) return@OnActivityResult
      val promise = pendingProjection ?: return@OnActivityResult
      pendingProjection = null
      if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
        promise.resolve(result("cancelled", "Você não autorizou a captura de tela.", "user_declined"))
        return@OnActivityResult
      }
      val ctx = context
      val intent = Intent(ctx, JarvisScreenService::class.java)
        .putExtra(JarvisScreenService.EXTRA_RESULT_CODE, payload.resultCode)
        .putExtra(JarvisScreenService.EXTRA_DATA, payload.data)
      try {
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(intent) else ctx.startService(intent)
        promise.resolve(result("completed", "Modo assistir junto ligado. Pergunte \"Jarvis, o que é isso?\"."))
      } catch (e: RuntimeException) {
        promise.resolve(result("failed", "Não consegui iniciar a captura: ${e.message}", "native_error"))
      }
    }

    AsyncFunction("stopScreenWatch") {
      JarvisScreenService.instance?.requestStop()
      true
    }.runOnQueue(Queues.MAIN)

    /** Quadro atual da tela em JPEG base64, ou nulo se o modo não estiver ligado. */
    AsyncFunction("captureScreen") {
      JarvisScreenService.instance?.captureJpegBase64()
    }
  }

  companion object {
    private const val REQUEST_PROJECTION = 41077
  }
}
