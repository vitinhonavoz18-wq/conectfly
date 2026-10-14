import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { JarvisAccessibility, JarvisDevice, type AccessibilityStatus, type LaunchableApp, type PermissionStatus } from '../../modules/jarvis-device';
import { checkBackendUrl } from '../core/backendUrl';
import { isBlockedPackage } from '../core/policy';
import { BackendError, healthCheck, pairDevice } from '../services/backend';
import { listApps } from '../services/executor';
import { requestMicPermission } from '../services/voice';
import { useJarvis } from '../state/JarvisProvider';
import { Body, Button, Card, Row, SectionTitle } from '../ui/components';
import { connectionLabel } from '../ui/labels';
import { Screen } from '../ui/Screen';
import { colors, radius, space } from '../ui/theme';

export default function SettingsScreen() {
  const { settings, updateSettings, connection, refreshConnection, disconnectBackend, clearHistory, runQuick } = useJarvis();
  const [url, setUrl] = useState(settings.backendUrl);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [connMsg, setConnMsg] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermissionStatus | null>(null);
  const [acc, setAcc] = useState<AccessibilityStatus | null>(null);
  const [apps, setApps] = useState<LaunchableApp[]>([]);
  const [showApps, setShowApps] = useState(false);

  const refreshPerms = useCallback(async () => {
    if (JarvisDevice) setPerms(await JarvisDevice.getPermissionStatus());
    if (JarvisAccessibility) setAcc(await JarvisAccessibility.getStatus());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPerms();
    }, [refreshPerms]),
  );

  const urlCheck = url ? checkBackendUrl(url) : null;
  const conn = connectionLabel(connection);

  async function saveUrlAndTest() {
    const c = checkBackendUrl(url);
    if (!c.ok) return setConnMsg(c.error);
    setBusy('test');
    await updateSettings({ backendUrl: c.url });
    const ok = await healthCheck(c.url);
    setConnMsg(ok ? 'Gateway encontrado. Agora informe o código de pareamento.' : 'Não encontrei o gateway nesse endereço. Ele está ligado? O celular está no mesmo Wi-Fi?');
    if (ok) await refreshConnection();
    setBusy(null);
  }

  async function pair() {
    const c = checkBackendUrl(url);
    if (!c.ok) return setConnMsg(c.error);
    setBusy('pair');
    try {
      await updateSettings({ backendUrl: c.url });
      await pairDevice(c.url, code.trim(), settings.deviceName);
      setCode('');
      setConnMsg('Celular pareado com sucesso.');
      await refreshConnection();
    } catch (e) {
      setConnMsg(e instanceof BackendError ? e.message : 'Falha no pareamento.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleApp(pkg: string, on: boolean) {
    if (isBlockedPackage(pkg)) return;
    const set = new Set(settings.allowedUiApps);
    if (on) set.add(pkg);
    else set.delete(pkg);
    await updateSettings({ allowedUiApps: [...set] });
    await refreshPerms();
  }

  return (
    <Screen title="Configurações" subtitle="Conexão, voz, permissões e privacidade">
      {/* ---------------- Backend ---------------- */}
      <Card>
        <SectionTitle>Conexão com o OpenJarvis</SectionTitle>
        <Row label="Status" value={conn.label} tone={conn.tone === 'neutral' ? undefined : conn.tone} />
        {connection.state === 'online' && connection.model ? <Row label="Modelo" value={connection.model} /> : null}
        {connection.state === 'offline' || connection.state === 'degraded' ? <Body dim>{connection.message}</Body> : null}
        <Text style={styles.label}>Endereço do gateway</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.0.10:8787"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          accessibilityLabel="Endereço do gateway"
        />
        {urlCheck && !urlCheck.ok ? <Text style={styles.err}>{urlCheck.error}</Text> : null}
        {urlCheck && urlCheck.ok && urlCheck.note ? <Text style={styles.warn}>{urlCheck.note}</Text> : null}
        <Button label="Salvar e testar endereço" onPress={() => void saveUrlAndTest()} busy={busy === 'test'} />
        <Text style={styles.label}>Código de pareamento (gerado no computador com “npm run pair”)</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="ABCD-1234"
          placeholderTextColor={colors.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Código de pareamento"
        />
        <Button label="Autenticar este celular" variant="primary" onPress={() => void pair()} disabled={code.trim().length < 8} busy={busy === 'pair'} />
        <Button label="Testar conexão" variant="ghost" onPress={() => void refreshConnection()} />
        {connMsg ? <Body dim>{connMsg}</Body> : null}
        {connection.state !== 'unconfigured' ? (
          <Button
            label="Desconectar este celular"
            variant="danger"
            onPress={async () => {
              const m = await disconnectBackend();
              setConnMsg(m);
            }}
          />
        ) : null}
        <Body dim>O aplicativo funciona sem backend para comandos diretos. A conversa com IA precisa do gateway e do OpenJarvis ligados.</Body>
      </Card>

      {/* ---------------- Voz ---------------- */}
      <Card>
        <SectionTitle>Voz</SectionTitle>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Ler respostas em voz alta</Text>
          <Switch value={settings.speakReplies} onValueChange={(v) => void updateSettings({ speakReplies: v })} accessibilityLabel="Ler respostas em voz alta" />
        </View>
        {perms ? (
          <>
            <Row label="Microfone" value={perms.microphone ? 'permitido' : 'não permitido'} tone={perms.microphone ? 'ok' : 'warn'} />
            <Row label="Reconhecimento de fala" value={perms.speechRecognitionAvailable ? 'disponível' : 'indisponível'} tone={perms.speechRecognitionAvailable ? 'ok' : 'danger'} />
            <Row label="Reconhecimento offline" value={perms.onDeviceRecognitionAvailable ? 'o aparelho oferece' : 'não oferecido'} />
            <Body dim>O Jarvis usa o reconhecimento do próprio Android. Dependendo do aparelho, ele pode precisar de internet.</Body>
          </>
        ) : null}
        {perms && !perms.microphone ? (
          <Button
            label="Permitir microfone"
            onPress={async () => {
              const r = await requestMicPermission();
              if (r === 'blocked') Alert.alert('Microfone bloqueado', 'Libere em Permissões do app (botão abaixo).');
              await refreshPerms();
            }}
          />
        ) : null}
      </Card>

      {/* ---------------- Acessibilidade ---------------- */}
      <Card>
        <SectionTitle>Navegação em outros apps (acessibilidade)</SectionTitle>
        <Row
          label="Serviço do Jarvis"
          value={acc?.connected ? 'ativo' : acc?.enabledInSettings ? 'ativado, conectando…' : 'desligado'}
          tone={acc?.connected ? 'ok' : 'warn'}
        />
        <Body>
          Quando ativo, o Jarvis pode LER os textos e botões visíveis e TOCAR, ROLAR, VOLTAR e PREENCHER campos — somente nos apps que você marcar abaixo e somente quando
          você pedir uma tarefa.
        </Body>
        <Body dim>
          Nunca lê nem preenche campos de senha. Apps de banco, pagamentos, autenticação e as configurações do Android são bloqueados. Antes de enviar, comprar, publicar ou
          apagar, o Jarvis mostra o destinatário e o conteúdo exatos e espera sua confirmação. Não há captura contínua da tela.
        </Body>
        <Body dim>Limitação: alguns apps não expõem seus elementos ou bloqueiam automação; nesses casos o Jarvis para e avisa.</Body>
        <Button
          label={acc?.enabledInSettings ? 'Abrir acessibilidade para desativar' : 'Ativar nas configurações do Android'}
          onPress={async () => {
            await JarvisAccessibility?.openAccessibilitySettings();
          }}
        />
        <Button
          label={showApps ? 'Ocultar apps' : `Escolher apps autorizados (${settings.allowedUiApps.length})`}
          variant="ghost"
          onPress={async () => {
            if (!showApps) setApps(await listApps(true));
            setShowApps(!showApps);
          }}
        />
        {showApps
          ? apps.map((a) => {
              const blocked = isBlockedPackage(a.packageName);
              return (
                <View key={a.packageName} style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>{a.label}</Text>
                    <Text style={styles.pkg}>{blocked ? 'bloqueado por segurança' : a.packageName}</Text>
                  </View>
                  <Switch
                    value={settings.allowedUiApps.includes(a.packageName)}
                    disabled={blocked}
                    onValueChange={(v) => void toggleApp(a.packageName, v)}
                    accessibilityLabel={`Autorizar ${a.label}`}
                  />
                </View>
              );
            })
          : null}
      </Card>

      {/* ---------------- Privacidade ---------------- */}
      <Card>
        <SectionTitle>Privacidade</SectionTitle>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enviar nomes dos apps instalados para a IA</Text>
          <Switch value={settings.shareAppList} onValueChange={(v) => void updateSettings({ shareAppList: v })} accessibilityLabel="Enviar nomes dos apps instalados" />
        </View>
        <Body dim>Desligado por padrão. Ajuda a IA a entender pedidos como “abra o app do mercado”.</Body>
        <Row label="Permissão Bluetooth" value={perms?.bluetoothConnect ? 'concedida' : 'não concedida'} />
        <Button label="Revogar permissões (tela do Android)" onPress={() => void runQuick('open_settings', { panel: 'app_details' })} />
        <Button
          label="Apagar histórico e conversa"
          variant="danger"
          onPress={() =>
            Alert.alert('Apagar histórico?', 'Remove a conversa e o registro de ações deste celular.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => void clearHistory() },
            ])
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textDim, fontSize: 13, marginTop: space.sm },
  input: {
    minHeight: 48,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
  },
  err: { color: colors.danger, fontSize: 13 },
  warn: { color: colors.warn, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 48 },
  switchLabel: { color: colors.text, fontSize: 15, flexShrink: 1 },
  pkg: { color: colors.textDim, fontSize: 12 },
});
