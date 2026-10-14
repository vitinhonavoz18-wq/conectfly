package expo.modules.jarvisdevice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reconhecimento de fala (fala → texto) com o SpeechRecognizer do Android.
 * Não confundir com TTS (texto → fala), que fica no expo-speech.
 *
 * Ciclo de vida: um reconhecedor por escuta. Ele é destruído ao terminar, em
 * erro, ao cancelar, quando o app vai para segundo plano e quando o módulo é
 * descartado — assim o microfone é sempre liberado.
 */
class JarvisSpeechModule : Module() {
  private var recognizer: SpeechRecognizer? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JarvisSpeech")

    Events("onReady", "onBegin", "onPartial", "onResult", "onError", "onEnd", "onVolume")

    AsyncFunction("isAvailable") {
      SpeechRecognizer.isRecognitionAvailable(context)
    }

    AsyncFunction("isOnDeviceAvailable") {
      if (Build.VERSION.SDK_INT >= 31) SpeechRecognizer.isOnDeviceRecognitionAvailable(context) else false
    }

    AsyncFunction("start") { locale: String ->
      release()
      val ctx = context
      if (ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        sendEvent("onError", mapOf("code" to "permission", "message" to "Permissão de microfone negada."))
        return@AsyncFunction false
      }
      if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
        sendEvent("onError", mapOf("code" to "unavailable", "message" to "Este aparelho não tem serviço de reconhecimento de fala."))
        return@AsyncFunction false
      }
      val r = SpeechRecognizer.createSpeechRecognizer(ctx)
      recognizer = r
      r.setRecognitionListener(listener)
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.packageName)
      }
      r.startListening(intent)
      true
    }.runOnQueue(Queues.MAIN)

    /** Para de ouvir e entrega o que já foi reconhecido. */
    AsyncFunction("stop") {
      recognizer?.stopListening()
      Unit
    }.runOnQueue(Queues.MAIN)

    /** Descarta a escuta sem resultado e libera o microfone. */
    AsyncFunction("cancel") {
      recognizer?.cancel()
      release()
      sendEvent("onEnd", mapOf("reason" to "cancelled"))
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersBackground {
      if (recognizer != null) {
        recognizer?.cancel()
        release()
        sendEvent("onEnd", mapOf("reason" to "background"))
      }
    }

    OnDestroy { release() }
  }

  private fun release() {
    recognizer?.setRecognitionListener(null)
    recognizer?.destroy()
    recognizer = null
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) = sendEvent("onReady", mapOf<String, Any?>())
    override fun onBeginningOfSpeech() = sendEvent("onBegin", mapOf<String, Any?>())
    override fun onRmsChanged(rmsdB: Float) = sendEvent("onVolume", mapOf("rms" to rmsdB.toDouble()))
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}

    override fun onPartialResults(partialResults: Bundle?) {
      val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
      sendEvent("onPartial", mapOf("text" to text))
    }

    override fun onResults(results: Bundle?) {
      val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
      release()
      if (list.isEmpty() || list[0].isBlank()) {
        sendEvent("onError", mapOf("code" to "no_match", "message" to "Não entendi. Pode repetir?"))
      } else {
        sendEvent("onResult", mapOf("text" to list[0], "alternatives" to list.drop(1)))
      }
      sendEvent("onEnd", mapOf("reason" to "done"))
    }

    override fun onError(error: Int) {
      val (code, message) = when (error) {
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "silence" to "Não ouvi nada. Toque de novo para falar."
        SpeechRecognizer.ERROR_NO_MATCH -> "no_match" to "Não entendi. Pode repetir?"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission" to "Permissão de microfone negada."
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
          "network" to "O reconhecimento de voz deste aparelho precisa de internet e a conexão falhou."
        SpeechRecognizer.ERROR_SERVER, 11 /* ERROR_SERVER_DISCONNECTED */, 10 /* ERROR_TOO_MANY_REQUESTS */ ->
          "service" to "O serviço de reconhecimento de voz está indisponível agora."
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy" to "O reconhecimento de voz está ocupado. Tente de novo."
        12 /* ERROR_LANGUAGE_NOT_SUPPORTED */, 13 /* ERROR_LANGUAGE_UNAVAILABLE */ ->
          "language" to "Português do Brasil não está disponível no reconhecimento deste aparelho."
        SpeechRecognizer.ERROR_AUDIO -> "audio" to "Falha ao acessar o microfone."
        else -> "client" to "O reconhecimento de voz foi interrompido."
      }
      release()
      sendEvent("onError", mapOf("code" to code, "message" to message))
      sendEvent("onEnd", mapOf("reason" to "error"))
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }
}
