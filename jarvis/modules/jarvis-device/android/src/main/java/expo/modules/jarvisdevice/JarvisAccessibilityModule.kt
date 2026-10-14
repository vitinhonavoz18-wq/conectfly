package expo.modules.jarvisdevice

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Ponte entre o JavaScript e o JarvisAccessibilityService. */
class JarvisAccessibilityModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JarvisAccessibility")

    AsyncFunction("getStatus") {
      mapOf(
        "enabledInSettings" to JarvisAccessibilityService.isEnabledInSettings(context),
        "connected" to (JarvisAccessibilityService.instance != null),
        "allowedPackages" to JarvisAccessibilityService.allowedPackages(context).toList()
      )
    }

    /** Abre a tela do sistema. O Jarvis nunca ativa o serviço sozinho. */
    AsyncFunction("openAccessibilitySettings") {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      try {
        val activity = appContext.currentActivity
        if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        result("completed", "Configurações de acessibilidade abertas.")
      } catch (e: ActivityNotFoundException) {
        result("unavailable", "Tela de acessibilidade não encontrada.", "not_supported")
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAllowedPackages") { packages: List<String> ->
      JarvisAccessibilityService.setAllowedPackages(context, packages.filter { it != context.packageName }.toSet())
      true
    }

    AsyncFunction("getForegroundPackage") {
      JarvisAccessibilityService.instance?.currentPackage()
    }

    AsyncFunction("observe") {
      val svc = JarvisAccessibilityService.instance
        ?: return@AsyncFunction mapOf("available" to false, "reason" to "Serviço de acessibilidade desligado.")
      svc.snapshot()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("performStep") { expectedPackage: String, kind: String, selector: Map<String, String?>, text: String? ->
      val svc = JarvisAccessibilityService.instance
        ?: return@AsyncFunction result("unavailable", "Serviço de acessibilidade desligado.", "permission_missing")
      svc.perform(expectedPackage, kind, selector, text)
    }.runOnQueue(Queues.MAIN)
  }
}
