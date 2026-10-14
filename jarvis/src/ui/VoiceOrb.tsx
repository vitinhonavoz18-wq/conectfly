import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import type { Phase } from '../state/JarvisProvider';
import { colors } from './theme';

const PHASE_SPEED: Record<Phase, number> = { ready: 2600, listening: 900, processing: 1300, speaking: 700, executing: 1100 };

/** Indicador central: anéis que "respiram" conforme o estado. Leve (só Animated nativo). */
export function VoiceOrb({ phase, volume, size = 200 }: { phase: Phase; volume: number; size?: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [level] = useState(() => new Animated.Value(0));
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v));
  }, []);

  useEffect(() => {
    if (reduceMotion.current) return;
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PHASE_SPEED[phase] / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: PHASE_SPEED[phase] / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    p.start();
    if (phase === 'processing' || phase === 'executing') s.start();
    return () => {
      p.stop();
      s.stop();
    };
  }, [phase, pulse, spin]);

  useEffect(() => {
    Animated.timing(level, { toValue: volume, duration: 120, useNativeDriver: true }).start();
  }, [volume, level]);

  const outerScale = Animated.add(
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, phase === 'ready' ? 1.04 : 1.1] }),
    level.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
  );
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, phase === 'ready' ? 0.4 : 0.7] });
  const active = phase !== 'ready';

  return (
    <View style={{ width: size * 1.3, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ring, { width: size * 1.2, height: size * 1.2, borderRadius: size, opacity: glow, transform: [{ scale: outerScale }] }]} />
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size, borderWidth: 6, borderColor: colors.cyan, transform: [{ scale: outerScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: size,
            borderWidth: 4,
            borderColor: colors.cyanDim,
            borderTopColor: active ? colors.cyan : colors.cyanDim,
            transform: [{ rotate }],
          },
        ]}
      />
      <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: colors.cyan }} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.cyan },
});
