package expo.modules.jarvisdevice

import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineActivationException
import ai.picovoice.porcupine.PorcupineActivationLimitException
import ai.picovoice.porcupine.PorcupineActivationRefusedException
import ai.picovoice.porcupine.PorcupineActivationThrottledException
import ai.picovoice.porcupine.PorcupineException
import ai.picovoice.porcupine.PorcupineManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/** Ponte simples entre os serviços e o módulo JS (eventos). */
object JarvisBus {
  @Volatile
  var listener: ((String, Map<String, Any?>) -> Unit)? = null

  fun emit(name: String, body: Map<String, Any?> = emptyMap()) {
    Handler(Looper.getMainLooper()).post { listener?.invoke(name, body) }
  }
}

/**
 * Escuta a palavra "Jarvis" em segundo plano, 100% no aparelho (Picovoice
 * Porcupine). Nenhum áudio sai do celular nesta etapa.
 *
 * - Serviço em primeiro plano do tipo "microphone", com notificação fixa
 *   (exigência do Android para usar o microfone com o app minimizado).
 * - Só pode ser iniciado com o app aberto na tela (regra do Android 14+).
 * - Ao ouvir "Jarvis", PARA de usar o microfone (para o reconhecimento de fala
 *   poder usá-lo) e avisa o app. O app chama resume() quando a conversa acaba.
 */
class JarvisWakeService : Service() {
  private var porcupine: PorcupineManager? = null
  private var accessKey: String = ""
  private var sensitivity: Float = 0.6f
  private val main = Handler(Looper.getMainLooper())

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        shutdown("Desligado pela notificação.")
        return START_NOT_STICKY
      }
    }
    accessKey = intent?.getStringExtra(EXTRA_KEY) ?: ""
    sensitivity = intent?.getFloatExtra(EXTRA_SENSITIVITY, 0.6f) ?: 0.6f
    startAsForeground()
    if (accessKey.isBlank()) {
      shutdown("Falta a chave do Picovoice (AccessKey) nas configurações do Jarvis.")
      return START_NOT_STICKY
    }
    if (!buildPorcupine()) return START_NOT_STICKY
    resumeListening()
    running = true
    JarvisBus.emit("onWakeState", mapOf("state" to "listening"))
    // Sem a chave guardada não dá para reiniciar sozinho: o app religa ao abrir.
    return START_NOT_STICKY
  }

  private fun buildPorcupine(): Boolean = try {
    porcupine?.delete()
    porcupine = PorcupineManager.Builder()
      .setAccessKey(accessKey)
      .setKeyword(Porcupine.BuiltInKeyword.JARVIS)
      .setSensitivity(sensitivity.coerceIn(0.1f, 0.95f))
      .setErrorCallback { e -> main.post { shutdown(describe(e)) } }
      .build(applicationContext) { _ -> main.post { onWakeWord() } }
    true
  } catch (e: PorcupineException) {
    shutdown(describe(e))
    false
  }

  private fun onWakeWord() {
    pauseListening() // libera o microfone para o reconhecimento de fala
    try {
      val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70)
      tone.startTone(ToneGenerator.TONE_PROP_ACK, 150)
      main.postDelayed({ tone.release() }, 400)
    } catch (_: RuntimeException) {
      // sem bipe neste aparelho; segue normalmente
    }
    JarvisBus.emit("onWake", mapOf("at" to System.currentTimeMillis()))
  }

  /** Chamado pelo app: desliga a escuta e remove a notificação. */
  fun requestStop() = shutdown(null)

  /** Chamado pelo app: pausa enquanto o Jarvis fala ou ouve a pergunta. */
  fun pause() = pauseListening()

  /** Chamado pelo app quando a conversa termina: volta a esperar "Jarvis". */
  fun resume() {
    if (porcupine != null) resumeListening()
  }

  private fun pauseListening() {
    try {
      porcupine?.stop()
      paused = true
    } catch (e: PorcupineException) {
      JarvisBus.emit("onWakeError", mapOf("message" to describe(e)))
    }
  }

  private fun resumeListening() {
    try {
      porcupine?.start()
      paused = false
      JarvisBus.emit("onWakeState", mapOf("state" to "listening"))
    } catch (e: PorcupineException) {
      shutdown(describe(e))
    } catch (e: SecurityException) {
      shutdown("O Android bloqueou o microfone em segundo plano. Abra o Jarvis e ligue de novo.")
    }
  }

  private fun shutdown(reason: String?) {
    try {
      porcupine?.stop()
    } catch (_: PorcupineException) {
    }
    porcupine?.delete()
    porcupine = null
    running = false
    paused = false
    if (reason != null) JarvisBus.emit("onWakeError", mapOf("message" to reason))
    JarvisBus.emit("onWakeState", mapOf("state" to "off"))
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    instance = null
    porcupine?.delete()
    porcupine = null
    running = false
    super.onDestroy()
  }

  private fun describe(e: PorcupineException): String = when (e) {
    is PorcupineActivationLimitException -> "A chave do Picovoice atingiu o limite de aparelhos."
    is PorcupineActivationThrottledException -> "Picovoice pediu para aguardar antes de ativar de novo."
    is PorcupineActivationRefusedException -> "A chave do Picovoice foi recusada. Confira a AccessKey."
    is PorcupineActivationException -> "Não consegui ativar o Picovoice (precisa de internet na primeira vez)."
    else -> "Falha no detector de \"Jarvis\": ${e.message ?: "erro desconhecido"}"
  }

  private fun startAsForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Jarvis ouvindo", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Aviso fixo enquanto o Jarvis espera ser chamado."
        }
      )
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
    val stop = PendingIntent.getService(this, 1, Intent(this, JarvisWakeService::class.java).setAction(ACTION_STOP), flags)
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let { PendingIntent.getActivity(this, 2, it, flags) }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Jarvis está esperando você chamar")
      .setContentText("Diga \"Jarvis\". O áudio é analisado só no celular até você chamar.")
      .setOngoing(true)
      .setContentIntent(open)
      .addAction(Notification.Action.Builder(null, "Desligar", stop).build())
      .build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    const val ACTION_STOP = "expo.modules.jarvisdevice.wake.STOP"
    const val EXTRA_KEY = "accessKey"
    const val EXTRA_SENSITIVITY = "sensitivity"
    private const val CHANNEL = "jarvis_wake"
    private const val NOTIFICATION_ID = 4101

    @Volatile
    var instance: JarvisWakeService? = null
      private set

    @Volatile
    var running = false
      private set

    @Volatile
    var paused = false
      private set
  }
}
