import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { ToolArgs, ToolName } from '../core/contract';
import { useJarvis } from '../state/JarvisProvider';
import { Body, Button, Card, Pill, SectionTitle } from '../ui/components';
import { STATUS_LABEL, statusTone } from '../ui/labels';
import { Screen } from '../ui/Screen';
import { colors, space } from '../ui/theme';

type Quick = { label: string; tool: ToolName; args: ToolArgs[ToolName] };

const QUICK: Quick[] = [
  { label: 'Configurações de Bluetooth', tool: 'open_settings', args: { panel: 'bluetooth' } },
  { label: 'Configurações de Wi-Fi', tool: 'open_settings', args: { panel: 'wifi' } },
  { label: 'Pausar / tocar mídia', tool: 'media_control', args: { command: 'play_pause' } },
  { label: 'Próxima faixa', tool: 'media_control', args: { command: 'next' } },
  { label: 'Consultar permissões', tool: 'check_permissions', args: {} },
];

export default function Actions() {
  const { records, runQuick, clearHistory, phase } = useJarvis();
  const [last, setLast] = useState<string | null>(null);

  return (
    <Screen title="Ações e histórico" subtitle="Tudo o que o Jarvis tentou fazer e o resultado real">
      <SectionTitle>Atalhos (executam de verdade)</SectionTitle>
      <View style={styles.grid}>
        {QUICK.map((q) => (
          <Button
            key={q.label}
            label={q.label}
            disabled={phase !== 'ready'}
            onPress={async () => {
              const r = await runQuick(q.tool, q.args);
              setLast(r.message);
            }}
            style={styles.quick}
          />
        ))}
      </View>
      {last ? <Body dim>Resultado: {last}</Body> : null}

      <SectionTitle>Histórico</SectionTitle>
      <Body dim>Por privacidade, o histórico guarda só o tipo de ação e o tamanho dos textos — nunca senhas ou o conteúdo compartilhado.</Body>
      {records.length === 0 ? <Body dim>Nenhuma ação registrada.</Body> : null}
      {records.slice(0, 100).map((r) => (
        <Card key={r.id}>
          <View style={styles.rowTop}>
            <Text style={styles.summary}>{r.summary}</Text>
            <Pill label={STATUS_LABEL[r.status]} tone={statusTone(r.status)} />
          </View>
          <Text style={styles.msg}>{r.message}</Text>
          <Text style={styles.meta}>
            {new Date(r.createdAt).toLocaleString('pt-BR')} · origem: {r.source === 'local' ? 'comando no aparelho' : r.source === 'backend' ? 'IA' : 'navegação'}
            {r.targetApp ? ` · ${r.targetApp}` : ''}
          </Text>
        </Card>
      ))}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quick: { flexGrow: 1, flexBasis: '45%' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  summary: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  msg: { color: colors.text, fontSize: 14 },
  meta: { color: colors.textDim, fontSize: 12 },
});
