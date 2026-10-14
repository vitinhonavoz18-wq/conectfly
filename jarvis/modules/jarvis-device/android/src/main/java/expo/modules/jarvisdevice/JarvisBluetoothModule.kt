package expo.modules.jarvisdevice

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Consulta e gerenciamento suportado de Bluetooth.
 * Não envia comandos a dispositivos: isso depende do perfil/protocolo de cada
 * equipamento e fica para adaptadores específicos no futuro.
 *
 * As chamadas protegidas só acontecem depois de hasConnectPermission(); o lint
 * não enxerga essa checagem própria, por isso o aviso é suprimido na classe.
 */
@SuppressLint("MissingPermission")
class JarvisBluetoothModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val adapter: BluetoothAdapter?
    get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private fun hasConnectPermission(): Boolean =
    Build.VERSION.SDK_INT < 31 ||
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("JarvisBluetooth")

    AsyncFunction("getStatus") {
      val pm = context.packageManager
      val a = adapter
      mapOf(
        "classicSupported" to pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH),
        "bleSupported" to pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE),
        "adapterPresent" to (a != null),
        "enabled" to (a?.isEnabled == true),
        "connectPermission" to hasConnectPermission(),
        "needsRuntimePermission" to (Build.VERSION.SDK_INT >= 31),
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }

    AsyncFunction("getBondedDevices") {
      val a = adapter ?: return@AsyncFunction result("unavailable", "Este aparelho não tem Bluetooth.", "not_supported")
      if (!hasConnectPermission()) {
        return@AsyncFunction result("refused", "Permissão de dispositivos próximos não concedida.", "permission_missing")
      }
      if (!a.isEnabled) {
        return@AsyncFunction result("unavailable", "O Bluetooth está desligado.", "not_supported")
      }
      val devices = try {
        a.bondedDevices.orEmpty().map { d -> describe(d) }
      } catch (e: SecurityException) {
        return@AsyncFunction result("refused", "O Android negou acesso aos dispositivos pareados.", "permission_missing")
      }
      result("completed", "${devices.size} dispositivo(s) pareado(s).", data = mapOf("devices" to devices))
    }

    AsyncFunction("openBluetoothSettings") {
      startSafe(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
    }.runOnQueue(Queues.MAIN)

    /** Mostra o diálogo do sistema pedindo para ligar o Bluetooth (o usuário decide). */
    AsyncFunction("requestEnable") {
      if (adapter == null) return@AsyncFunction result("unavailable", "Este aparelho não tem Bluetooth.", "not_supported")
      if (!hasConnectPermission()) return@AsyncFunction result("refused", "Permissão de dispositivos próximos não concedida.", "permission_missing")
      startSafe(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
    }.runOnQueue(Queues.MAIN)
  }

  private fun describe(d: BluetoothDevice): Map<String, Any?> {
    val type = when (d.type) {
      BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
      BluetoothDevice.DEVICE_TYPE_LE -> "ble"
      BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
      else -> "unknown"
    }
    val category = when (d.bluetoothClass?.majorDeviceClass) {
      BluetoothClass.Device.Major.AUDIO_VIDEO -> "audio"
      BluetoothClass.Device.Major.PHONE -> "phone"
      BluetoothClass.Device.Major.COMPUTER -> "computer"
      BluetoothClass.Device.Major.WEARABLE -> "wearable"
      BluetoothClass.Device.Major.HEALTH -> "health"
      BluetoothClass.Device.Major.PERIPHERAL -> "peripheral"
      BluetoothClass.Device.Major.IMAGING -> "imaging"
      BluetoothClass.Device.Major.TOY -> "toy"
      BluetoothClass.Device.Major.NETWORKING -> "networking"
      else -> "other"
    }
    return mapOf(
      "name" to (d.name ?: "Sem nome"),
      "address" to d.address,
      "type" to type,
      "category" to category,
      "bonded" to (d.bondState == BluetoothDevice.BOND_BONDED)
    )
  }

  private fun startSafe(intent: Intent): Map<String, Any?> = try {
    val activity = appContext.currentActivity
    if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    result("completed", "Aberto.")
  } catch (e: ActivityNotFoundException) {
    result("unavailable", "Tela de Bluetooth não disponível neste aparelho.", "not_supported")
  } catch (e: SecurityException) {
    result("refused", "O Android bloqueou esta ação.", "permission_missing")
  }
}
