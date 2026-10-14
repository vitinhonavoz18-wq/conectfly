package expo.modules.jarvisdevice

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Base64
import android.util.DisplayMetrics
import android.view.WindowManager
import java.io.ByteArrayOutputStream

/**
 * "Assistir junto": mantém uma captura de tela ativa SÓ depois que você aceita
 * o aviso do próprio Android (que mostra o ícone de transmissão enquanto dura).
 *
 * Não grava vídeo nem envia nada sozinho: guarda apenas o quadro mais recente
 * na memória. Uma imagem é enviada à IA somente quando você faz uma pergunta.
 * Apps protegidos (bancos, Netflix etc.) aparecem pretos — bloqueio do Android.
 */
class JarvisScreenService : Service() {
  private var projection: MediaProjection? = null
  private var display: VirtualDisplay? = null
  private var reader: ImageReader? = null
  private var thread: HandlerThread? = null
  private var latest: Image? = null
  private val lock = Any()
  private var width = 0
  private var height = 0
  private var stopped = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopAll("Desligado pela notificação.")
      return START_NOT_STICKY
    }
    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
    @Suppress("DEPRECATION")
    val data: Intent? = intent?.getParcelableExtra(EXTRA_DATA)
    // Android 14: o serviço precisa estar em primeiro plano ANTES de pegar a projeção.
    startAsForeground()
    if (resultCode != Activity.RESULT_OK || data == null) {
      stopAll("Permissão de captura de tela não concedida.")
      return START_NOT_STICKY
    }
    try {
      val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      val p = mpm.getMediaProjection(resultCode, data)
      if (p == null) {
        stopAll("O Android não liberou a captura de tela.")
        return START_NOT_STICKY
      }
      projection = p
      val handlerThread = HandlerThread("jarvis-screen").also { it.start() }
      thread = handlerThread
      val handler = Handler(handlerThread.looper)
      p.registerCallback(
        object : MediaProjection.Callback() {
          override fun onStop() {
            stopAll("A captura de tela foi encerrada pelo Android.")
          }
        },
        handler
      )
      val metrics = screenMetrics()
      val scale = minOf(1f, MAX_WIDTH.toFloat() / metrics.widthPixels)
      width = (metrics.widthPixels * scale).toInt().coerceAtLeast(1)
      height = (metrics.heightPixels * scale).toInt().coerceAtLeast(1)
      val r = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
      reader = r
      r.setOnImageAvailableListener({ ir ->
        val img = try { ir.acquireLatestImage() } catch (e: IllegalStateException) { null }
        if (img != null) {
          synchronized(lock) {
            latest?.close()
            latest = img
          }
        }
      }, handler)
      display = p.createVirtualDisplay(
        "jarvis-screen", width, height, (metrics.densityDpi * scale).toInt().coerceAtLeast(120),
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, r.surface, null, handler
      )
      running = true
      JarvisBus.emit("onScreenState", mapOf("state" to "on"))
    } catch (e: SecurityException) {
      stopAll("O Android recusou a captura de tela: ${e.message}")
    } catch (e: IllegalStateException) {
      stopAll("Não foi possível iniciar a captura: ${e.message}")
    }
    return START_NOT_STICKY
  }

  /** Chamado pelo app: encerra a captura e remove a notificação. */
  fun requestStop() = stopAll(null)

  /** Converte o quadro mais recente em JPEG (base64). Nulo se ainda não há quadro. */
  fun captureJpegBase64(quality: Int = 60): String? {
    synchronized(lock) {
      val img = latest ?: return null
      val plane = img.planes[0]
      val pixelStride = plane.pixelStride
      val rowPadding = plane.rowStride - pixelStride * img.width
      val padded = Bitmap.createBitmap(img.width + rowPadding / pixelStride, img.height, Bitmap.Config.ARGB_8888)
      plane.buffer.rewind()
      padded.copyPixelsFromBuffer(plane.buffer)
      val bmp = Bitmap.createBitmap(padded, 0, 0, img.width, img.height)
      val out = ByteArrayOutputStream()
      bmp.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(30, 90), out)
      if (bmp !== padded) bmp.recycle()
      padded.recycle()
      return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
  }

  private fun screenMetrics(): DisplayMetrics {
    val dm = DisplayMetrics()
    val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    if (Build.VERSION.SDK_INT >= 30) {
      val bounds = wm.maximumWindowMetrics.bounds
      dm.widthPixels = bounds.width()
      dm.heightPixels = bounds.height()
      dm.densityDpi = resources.displayMetrics.densityDpi
    } else {
      @Suppress("DEPRECATION")
      wm.defaultDisplay.getRealMetrics(dm)
    }
    return dm
  }

  private fun stopAll(reason: String?) {
    if (stopped) return // o callback onStop também chega aqui depois de projection.stop()
    stopped = true
    synchronized(lock) {
      latest?.close()
      latest = null
    }
    display?.release()
    display = null
    reader?.close()
    reader = null
    try {
      projection?.stop()
    } catch (_: RuntimeException) {
    }
    projection = null
    thread?.quitSafely()
    thread = null
    running = false
    if (reason != null) JarvisBus.emit("onScreenError", mapOf("message" to reason))
    JarvisBus.emit("onScreenState", mapOf("state" to "off"))
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    if (running) stopAll(null)
    instance = null
    super.onDestroy()
  }

  private fun startAsForeground() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Jarvis assistindo junto", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Aviso fixo enquanto o Jarvis pode ver a tela quando você perguntar."
        }
      )
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
    val stop = PendingIntent.getService(this, 3, Intent(this, JarvisScreenService::class.java).setAction(ACTION_STOP), flags)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("Jarvis pode ver a tela quando você perguntar")
      .setContentText("Nada é enviado sem uma pergunta sua. Toque em Parar para desligar.")
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Parar", stop).build())
      .build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    const val ACTION_STOP = "expo.modules.jarvisdevice.screen.STOP"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_DATA = "data"
    private const val CHANNEL = "jarvis_screen"
    private const val NOTIFICATION_ID = 4102
    private const val MAX_WIDTH = 720

    @Volatile
    var instance: JarvisScreenService? = null
      private set

    @Volatile
    var running = false
      private set
  }
}
