import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, space } from './theme';

type BtnProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({ label, onPress, variant = 'secondary', disabled, busy, style, accessibilityHint }: BtnProps) {
  const bg = variant === 'primary' ? colors.cyan : variant === 'danger' ? '#3B1D1D' : variant === 'ghost' ? 'transparent' : colors.surface2;
  const fg = variant === 'primary' ? '#06222A' : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderColor: variant === 'ghost' ? colors.border : bg },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <Text style={[styles.body, dim && { color: colors.textDim }]}>{children}</Text>;
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'ok' | 'warn' | 'danger' | 'neutral' | 'cyan' }) {
  const c = tone === 'ok' ? colors.ok : tone === 'warn' ? colors.warn : tone === 'danger' ? colors.danger : tone === 'cyan' ? colors.cyan : colors.textDim;
  return (
    <View style={[styles.pill, { borderColor: c }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.pillText, { color: c }]}>{label}</Text>
    </View>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const c = tone === 'ok' ? colors.ok : tone === 'warn' ? colors.warn : tone === 'danger' ? colors.danger : colors.text;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: c }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: space.md },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 4, flexWrap: 'wrap' },
  rowLabel: { color: colors.textDim, fontSize: 15, flexShrink: 1 },
  rowValue: { fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
