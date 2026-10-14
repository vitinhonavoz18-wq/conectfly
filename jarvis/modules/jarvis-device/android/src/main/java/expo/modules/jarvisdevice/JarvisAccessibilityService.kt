package expo.modules.jarvisdevice

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.ArrayDeque

/**
 * Serviço de acessibilidade do Jarvis.
 *
 * - Só é ativado manualmente pelo usuário nas configurações do Android.
 * - Só lê e age em pacotes que o usuário autorizou (lista guardada localmente).
 * - Nunca lê o texto de campos de senha e nunca preenche esses campos.
 * - Age por seletores semânticos (id, texto, descrição), nunca por coordenadas.
 * - Não registra em log o conteúdo das telas.
 */
class JarvisAccessibilityService : AccessibilityService() {

  @Volatile
  private var foregroundPackage: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      event.packageName?.toString()?.let { foregroundPackage = it }
    }
  }

  override fun onInterrupt() {}

  override fun onUnbind(intent: android.content.Intent?): Boolean {
    instance = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    instance = null
    super.onDestroy()
  }

  fun currentPackage(): String? = rootInActiveWindow?.packageName?.toString() ?: foregroundPackage

  /** Lê a tela do app em primeiro plano, se ele estiver autorizado. */
  fun snapshot(maxNodes: Int = 150): Map<String, Any?> {
    val root = rootInActiveWindow ?: return mapOf("available" to false, "reason" to "Nenhuma janela acessível no momento.")
    val pkg = root.packageName?.toString() ?: ""
    if (!isAllowed(this, pkg)) {
      // Não lê nada de apps não autorizados: devolve só o nome do pacote.
      return mapOf("available" to true, "allowed" to false, "packageName" to pkg, "nodes" to emptyList<Any>(), "fingerprint" to "", "truncated" to false)
    }
    val nodes = ArrayList<Map<String, Any?>>()
    val fp = StringBuilder()
    var truncated = false
    var title: String? = null
    val queue = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
    queue.add(root to 0)
    var id = 0
    while (queue.isNotEmpty()) {
      val (node, depth) = queue.removeFirst()
      if (nodes.size >= maxNodes) { truncated = true; break }
      if (!node.isVisibleToUser) continue
      val isPassword = node.isPassword
      val text = if (isPassword) null else node.text?.toString()?.take(200)
      val desc = node.contentDescription?.toString()?.take(200)
      val viewId = node.viewIdResourceName
      val cls = node.className?.toString()
      if (title == null && Build.VERSION.SDK_INT >= 28 && node.isHeading && !text.isNullOrBlank()) title = text
      val interesting = node.isClickable || node.isEditable || node.isScrollable || !text.isNullOrBlank() || !desc.isNullOrBlank()
      if (interesting) {
        nodes.add(
          mapOf(
            "id" to id++,
            "text" to text,
            "contentDescription" to desc,
            "viewId" to viewId,
            "className" to cls,
            "clickable" to node.isClickable,
            "editable" to node.isEditable,
            "scrollable" to node.isScrollable,
            "isPassword" to isPassword
          )
        )
        fp.append(cls).append('|').append(viewId).append('|').append(if (isPassword) "*" else text).append('|').append(desc).append(';')
      }
      if (depth < 40) {
        for (i in 0 until node.childCount) node.getChild(i)?.let { queue.add(it to depth + 1) }
      }
    }
    if (title == null) {
      title = try { root.window?.title?.toString() } catch (e: Exception) { null }
    }
    return mapOf(
      "available" to true,
      "allowed" to true,
      "packageName" to pkg,
      "screenTitle" to title,
      "fingerprint" to Integer.toHexString(fp.toString().hashCode()) + ":" + nodes.size,
      "nodes" to nodes,
      "truncated" to truncated
    )
  }

  /**
   * Executa UM passo. Devolve "dispatched" quando o Android aceitou a ação —
   * isso NÃO é confirmação de resultado; quem confirma é a nova observação feita
   * pelo ciclo em JavaScript.
   */
  fun perform(expectedPackage: String, kind: String, selector: Map<String, String?>, text: String?): Map<String, Any?> {
    val root = rootInActiveWindow ?: return result("unavailable", "Nenhuma janela acessível.", "target_not_found")
    val pkg = root.packageName?.toString() ?: ""
    if (pkg != expectedPackage) return result("refused", "O aplicativo na tela mudou ($pkg). Parei.", "context_changed")
    if (!isAllowed(this, pkg)) return result("refused", "Aplicativo não autorizado.", "app_not_allowed")

    if (kind == "back") {
      val ok = performGlobalAction(GLOBAL_ACTION_BACK)
      return if (ok) result("completed", "Comando voltar enviado.", data = mapOf("dispatched" to true))
      else result("failed", "O Android recusou o comando voltar.", "native_error")
    }

    val target = find(root, selector, kind)
    if (kind == "scroll_forward" || kind == "scroll_backward") {
      val scrollable = target?.let { nearest(it) { n -> n.isScrollable } } ?: firstMatching(root) { it.isScrollable && it.isVisibleToUser }
        ?: return result("unavailable", "Não encontrei área rolável.", "target_not_found")
      val action = if (kind == "scroll_forward") AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
      val ok = scrollable.performAction(action)
      return if (ok) result("completed", "Rolagem enviada.", data = mapOf("dispatched" to true))
      else result("failed", "Não foi possível rolar (fim da lista?).", "native_error")
    }

    if (target == null) return result("unavailable", "Não encontrei o elemento indicado na tela.", "target_not_found")

    return when (kind) {
      "click" -> {
        val clickable = nearest(target) { it.isClickable }
          ?: return result("unavailable", "O elemento encontrado não é clicável.", "target_not_found")
        val ok = clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        if (ok) result("completed", "Toque enviado.", data = mapOf("dispatched" to true))
        else result("failed", "O aplicativo não aceitou o toque.", "native_error")
      }
      "set_text" -> {
        val field = nearest(target) { it.isEditable }
          ?: return result("unavailable", "O elemento não é um campo de texto.", "target_not_found")
        if (field.isPassword) return result("refused", "O Jarvis não preenche campos de senha.", "policy_denied")
        val args = Bundle().apply {
          putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text ?: "")
        }
        val ok = field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        if (!ok) return result("failed", "O campo não aceitou o texto.", "native_error")
        field.refresh()
        val verified = field.text?.toString() == (text ?: "")
        result(
          "completed",
          if (verified) "Texto preenchido e conferido." else "Texto enviado, mas o campo mostra outro conteúdo.",
          data = mapOf("dispatched" to true, "verified" to verified)
        )
      }
      else -> result("refused", "Passo desconhecido.", "invalid_action")
    }
  }

  private fun matches(node: AccessibilityNodeInfo, selector: Map<String, String?>, exact: Boolean): Boolean {
    val viewId = selector["viewId"]
    val text = selector["text"]?.trim()
    val desc = selector["contentDescription"]?.trim()
    val cls = selector["className"]
    if (!node.isVisibleToUser) return false
    if (!cls.isNullOrBlank() && node.className?.toString()?.endsWith(cls) != true) return false
    if (!viewId.isNullOrBlank() && node.viewIdResourceName != viewId && node.viewIdResourceName?.endsWith(":id/$viewId") != true) return false
    val nodeText = if (node.isPassword) null else node.text?.toString()?.trim()
    val nodeDesc = node.contentDescription?.toString()?.trim()
    if (!text.isNullOrBlank()) {
      val ok = if (exact) nodeText.equals(text, ignoreCase = true) else nodeText?.contains(text, ignoreCase = true) == true
      if (!ok) return false
    }
    if (!desc.isNullOrBlank()) {
      val ok = if (exact) nodeDesc.equals(desc, ignoreCase = true) else nodeDesc?.contains(desc, ignoreCase = true) == true
      if (!ok) return false
    }
    return !viewId.isNullOrBlank() || !text.isNullOrBlank() || !desc.isNullOrBlank()
  }

  /** Busca exata primeiro; se não achar, parcial. Ambíguo (vários parciais) = não age. */
  private fun find(root: AccessibilityNodeInfo, selector: Map<String, String?>, kind: String): AccessibilityNodeInfo? {
    if (selector.values.all { it.isNullOrBlank() }) return null
    val exact = allMatching(root) { matches(it, selector, true) }
    if (exact.isNotEmpty()) return prefer(exact, kind)
    val partial = allMatching(root) { matches(it, selector, false) }
    return if (partial.size == 1) partial[0] else null
  }

  private fun prefer(list: List<AccessibilityNodeInfo>, kind: String): AccessibilityNodeInfo =
    when (kind) {
      "click" -> list.firstOrNull { it.isClickable } ?: list[0]
      "set_text" -> list.firstOrNull { it.isEditable } ?: list[0]
      else -> list[0]
    }

  private fun nearest(node: AccessibilityNodeInfo, pred: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
    var cur: AccessibilityNodeInfo? = node
    var hops = 0
    while (cur != null && hops < 6) {
      if (pred(cur)) return cur
      cur = cur.parent
      hops++
    }
    return null
  }

  private fun allMatching(root: AccessibilityNodeInfo, pred: (AccessibilityNodeInfo) -> Boolean): List<AccessibilityNodeInfo> {
    val out = ArrayList<AccessibilityNodeInfo>()
    val q = ArrayDeque<AccessibilityNodeInfo>()
    q.add(root)
    var visited = 0
    while (q.isNotEmpty() && visited < 2000) {
      val n = q.removeFirst()
      visited++
      if (pred(n)) out.add(n)
      for (i in 0 until n.childCount) n.getChild(i)?.let { q.add(it) }
    }
    return out
  }

  private fun firstMatching(root: AccessibilityNodeInfo, pred: (AccessibilityNodeInfo) -> Boolean) =
    allMatching(root, pred).firstOrNull()

  companion object {
    @Volatile
    var instance: JarvisAccessibilityService? = null

    private const val PREFS = "jarvis_accessibility"
    private const val KEY_ALLOWED = "allowed_packages"

    fun isEnabledInSettings(context: Context): Boolean {
      val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
      val me = ComponentName(context, JarvisAccessibilityService::class.java)
      val splitter = TextUtils.SimpleStringSplitter(':')
      splitter.setString(enabled)
      for (s in splitter) {
        val cn = ComponentName.unflattenFromString(s)
        if (cn != null && cn == me) return true
      }
      return false
    }

    fun allowedPackages(context: Context): Set<String> =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY_ALLOWED, emptySet()) ?: emptySet()

    fun setAllowedPackages(context: Context, packages: Set<String>) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY_ALLOWED, HashSet(packages)).apply()
    }

    fun isAllowed(context: Context, pkg: String): Boolean =
      pkg.isNotEmpty() && pkg != context.packageName && allowedPackages(context).contains(pkg)
  }
}
