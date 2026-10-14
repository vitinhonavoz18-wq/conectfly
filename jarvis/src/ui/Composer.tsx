import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useJarvis } from '../state/JarvisProvider';
import { colors, radius, space } from './theme';

/** Campo de texto sempre disponível + enviar. Mostra o texto reconhecido para edição. */
export function Composer() {
  const { draft, setDraft, send, phase } = useJarvis();
  const busy = phase === 'processing' || phase === 'executing';
  return (
    <View style={styles.wrap}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Digite ou fale um comando…"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        multiline
        maxLength={2000}
        accessibilityLabel="Mensagem para o Jarvis"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
        blurOnSubmit
      />
      <Pressable
        onPress={() => void send()}
        disabled={!draft.trim() || busy}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensagem"
        style={({ pressed }) => [styles.send, { opacity: !draft.trim() || busy ? 0.4 : pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.sendText}>Enviar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  send: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.cyan, justifyContent: 'center' },
  sendText: { color: '#06222A', fontWeight: '700', fontSize: 16 },
});
