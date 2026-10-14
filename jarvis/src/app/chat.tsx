import React, { useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJarvis } from '../state/JarvisProvider';
import { Button, Pill } from '../ui/components';
import { Composer } from '../ui/Composer';
import { connectionLabel, PHASE_LABEL } from '../ui/labels';
import { colors, radius, space } from '../ui/theme';
import type { ChatMessage } from '../services/storage';

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'system') {
    return <Text style={styles.system}>⚙ {m.text}</Text>;
  }
  const mine = m.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]} accessible accessibilityLabel={`${mine ? 'Você' : 'Jarvis'}: ${m.text}`}>
      {!mine && m.local ? <Text style={styles.tag}>no aparelho</Text> : null}
      <Text style={styles.text} selectable>
        {m.text}
      </Text>
    </View>
  );
}

export default function Chat() {
  const { messages, phase, listen, stopListen, cancelAll, connection, partial } = useJarvis();
  const list = useRef<FlatList<ChatMessage>>(null);
  const conn = connectionLabel(connection);
  const listening = phase === 'listening';
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Conversa
          </Text>
          <Pill label={conn.label} tone={conn.tone} />
        </View>
        {connection.state !== 'online' ? (
          <Text style={styles.offline}>
            Respostas livres dependem da conexão com o backend OpenJarvis. Sem ela, só comandos diretos funcionam (abrir apps, links, mapas, configurações, discador, mídia).
          </Text>
        ) : null}
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble m={item} />}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.offline}>Nenhuma mensagem ainda.</Text>}
        />
        <View style={styles.bottom}>
          <Text style={styles.phase} accessibilityLiveRegion="polite">
            {PHASE_LABEL[phase]}
            {listening && partial ? ` “${partial}”` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label={listening ? 'Parar' : 'Falar'} variant="primary" onPress={() => void (listening ? stopListen() : listen())} disabled={phase !== 'ready' && !listening} style={{ flex: 1 }} />
            {phase !== 'ready' ? <Button label="Interromper" variant="danger" onPress={() => void cancelAll()} style={{ flex: 1 }} /> : null}
          </View>
          <Composer />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: space.sm, gap: space.sm },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  offline: { color: colors.textDim, fontSize: 13, paddingHorizontal: space.lg, lineHeight: 18 },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: space.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.cyanDim },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface2 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  tag: { color: colors.textDim, fontSize: 11, marginBottom: 2 },
  system: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  bottom: { padding: space.md, gap: space.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  phase: { color: colors.cyan, fontSize: 14 },
});
