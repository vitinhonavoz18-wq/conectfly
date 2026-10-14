import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useJarvis } from '../state/JarvisProvider';
import { Button, Pill } from '../ui/components';
import { Composer } from '../ui/Composer';
import { connectionLabel, PHASE_LABEL } from '../ui/labels';
import { Screen } from '../ui/Screen';
import { colors, radius, space } from '../ui/theme';
import { VoiceOrb } from '../ui/VoiceOrb';

export default function Home() {
  const { phase, volume, partial, draft, listen, stopListen, cancelAll, connection, messages, progress, notice, dismissNotice, wakeState, conversation, screenWatch } =
    useJarvis();
  const conn = connectionLabel(connection);
  const lastReply = [...messages].reverse().find((m) => m.role === 'assistant');
  const listening = phase === 'listening';
  const busy = phase !== 'ready';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Jarvis" subtitle="Seu assistente por voz">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label={conn.label} tone={conn.tone} />
          {wakeState !== 'off' ? <Pill label={conversation ? 'Em conversa' : 'Diga “Jarvis”'} tone="cyan" /> : null}
          {screenWatch ? <Pill label="Assistindo junto" tone="cyan" /> : null}
        </View>
        {notice ? (
          <Pressable onPress={dismissNotice} accessibilityRole="button" accessibilityHint="Toque para fechar o aviso" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        <View style={styles.center}>
          <VoiceOrb phase={phase} volume={volume} size={180} />
          <Text style={styles.phase} accessibilityLiveRegion="polite">
            {PHASE_LABEL[phase]}
          </Text>
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
          {listening && partial ? <Text style={styles.partial}>“{partial}”</Text> : null}
        </View>

        <Button
          label={listening ? 'Parar e usar o que ouvi' : 'Falar com Jarvis'}
          variant="primary"
          onPress={() => void (listening ? stopListen() : listen())}
          disabled={busy && !listening}
          style={{ minHeight: 60 }}
          accessibilityHint="Toque para o Jarvis ouvir seu comando em português"
        />
        {busy ? <Button label="Interromper" variant="danger" onPress={() => void cancelAll()} accessibilityHint="Para a fala, a escuta e cancela a ação em andamento" /> : null}

        {draft ? <Text style={styles.hint}>Confira ou edite o texto reconhecido e toque em Enviar.</Text> : null}
        <Composer />

        {lastReply ? (
          <View style={styles.reply}>
            <Text style={styles.replyLabel}>{lastReply.local ? 'Jarvis (no aparelho)' : 'Jarvis (IA)'}</Text>
            <Text style={styles.replyText}>{lastReply.text}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Experimente: “Abra o YouTube”, “Abra as configurações de Bluetooth”, “Abra o mapa com este endereço: Av. Paulista, 1000”.</Text>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  phase: { color: colors.cyan, fontSize: 20, fontWeight: '600' },
  progress: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  partial: { color: colors.text, fontSize: 16, fontStyle: 'italic', textAlign: 'center' },
  hint: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  reply: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderLeftWidth: 3, borderLeftColor: colors.cyan, gap: 4 },
  replyLabel: { color: colors.textDim, fontSize: 12 },
  replyText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  notice: { backgroundColor: '#3A2E12', borderRadius: radius.md, padding: space.md },
  noticeText: { color: colors.warn, fontSize: 14 },
});
