import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useJarvis } from '../state/JarvisProvider';
import { Button } from './components';
import { colors, radius, space } from './theme';

/** Confirmação obrigatória para ações com efeito externo, com os dados exatos. */
export function ConfirmModal() {
  const { pendingConfirm, answerConfirm } = useJarvis();
  if (!pendingConfirm) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => answerConfirm(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {pendingConfirm.title}
          </Text>
          <Text style={styles.reason}>Motivo da confirmação: {pendingConfirm.reason}.</Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {pendingConfirm.details.map((d, i) => (
              <View key={i} style={styles.detail}>
                <Text style={styles.label}>{d.label}</Text>
                <Text style={styles.value} selectable>
                  {d.value}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Button label="Cancelar" onPress={() => answerConfirm(false)} style={{ flex: 1 }} />
            <Button label="Confirmar" variant="primary" onPress={() => answerConfirm(true)} style={{ flex: 1 }} />
          </View>
          <Text style={styles.hint}>Sem resposta em 60 segundos, a ação é cancelada.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, padding: space.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: space.md, borderTopWidth: 2, borderColor: colors.warn },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  reason: { color: colors.warn, fontSize: 14 },
  detail: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { color: colors.textDim, fontSize: 13 },
  value: { color: colors.text, fontSize: 16, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  hint: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
});
