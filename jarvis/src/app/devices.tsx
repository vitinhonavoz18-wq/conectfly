import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { PermissionsAndroid, StyleSheet, Text, View } from 'react-native';
import { JarvisBluetooth, type BluetoothDeviceInfo, type BluetoothStatus } from '../../modules/jarvis-device';
import { listAdapters } from '../core/bluetoothAdapters';
import { Body, Button, Card, Pill, Row, SectionTitle } from '../ui/components';
import { Screen } from '../ui/Screen';
import { colors, space } from '../ui/theme';

const TYPE_LABEL: Record<BluetoothDeviceInfo['type'], string> = {
  classic: 'Bluetooth clássico',
  ble: 'BLE (baixa energia)',
  dual: 'Clássico + BLE',
  unknown: 'Tipo desconhecido',
};

export default function Devices() {
  const [status, setStatus] = useState<BluetoothStatus | null>(null);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!JarvisBluetooth) {
      setMessage('Bluetooth disponível só no APK do Jarvis.');
      return;
    }
    const st = await JarvisBluetooth.getStatus();
    setStatus(st);
    if (st.connectPermission && st.enabled) {
      const r = await JarvisBluetooth.getBondedDevices();
      if (r.status === 'completed') {
        setDevices((r.data?.devices as BluetoothDeviceInfo[]) ?? []);
        setMessage(null);
      } else {
        setDevices(null);
        setMessage(r.message);
      }
    } else {
      setDevices(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const requestPermission = async () => {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, {
      title: 'Dispositivos próximos',
      message: 'O Jarvis precisa desta permissão para listar os dispositivos Bluetooth já pareados.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    });
    if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) setMessage('Permissão bloqueada. Libere em Ajustes → Permissões do app.');
    else if (r !== PermissionsAndroid.RESULTS.GRANTED) setMessage('Permissão negada. A lista de pareados fica indisponível.');
    await refresh();
  };

  return (
    <Screen title="Dispositivos" subtitle="Bluetooth: consulta e gerenciamento suportado">
      <Card>
        <SectionTitle>Estado</SectionTitle>
        {status ? (
          <>
            <Row label="Bluetooth clássico" value={status.classicSupported ? 'suportado' : 'não suportado'} />
            <Row label="BLE (baixa energia)" value={status.bleSupported ? 'suportado' : 'não suportado'} />
            <Row label="Ligado" value={status.enabled ? 'sim' : 'não'} tone={status.enabled ? 'ok' : 'warn'} />
            <Row
              label="Permissão de dispositivos próximos"
              value={status.connectPermission ? 'concedida' : 'não concedida'}
              tone={status.connectPermission ? 'ok' : 'warn'}
            />
          </>
        ) : (
          <Body dim>{message ?? 'Consultando…'}</Body>
        )}
        <View style={styles.actions}>
          {status && !status.connectPermission ? <Button label="Permitir acesso" variant="primary" onPress={() => void requestPermission()} /> : null}
          {status && !status.enabled && status.connectPermission ? (
            <Button label="Pedir para ligar" onPress={async () => setMessage((await JarvisBluetooth!.requestEnable()).message)} />
          ) : null}
          <Button label="Abrir Bluetooth do Android (parear)" onPress={async () => setMessage((await JarvisBluetooth?.openBluetoothSettings())?.message ?? null)} />
          <Button label="Atualizar" variant="ghost" onPress={() => void refresh()} />
        </View>
        {message && status ? <Body dim>{message}</Body> : null}
      </Card>

      <SectionTitle>Pareados</SectionTitle>
      {devices === null ? <Body dim>Disponível com Bluetooth ligado e permissão concedida.</Body> : null}
      {devices?.length === 0 ? <Body dim>Nenhum dispositivo pareado.</Body> : null}
      {devices?.map((d) => (
        <Card key={d.address}>
          <Text style={styles.name}>{d.name}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Pill label={TYPE_LABEL[d.type]} tone="cyan" />
            <Pill label={d.category} />
          </View>
          <Text style={styles.addr}>{d.address}</Text>
          <Body dim>Sem adaptador: só visualização. Controle exige protocolo específico do equipamento.</Body>
        </Card>
      ))}

      <Card>
        <SectionTitle>Sobre controle de dispositivos</SectionTitle>
        <Body>
          Estar pareado não significa que o Jarvis pode controlar o aparelho. Cada equipamento fala um “idioma” próprio: perfis no Bluetooth clássico (como fones e
          caixas de som) ou serviços e características no BLE (como balanças e pulseiras).
        </Body>
        <Body dim>Adaptadores instalados: {listAdapters().length === 0 ? 'nenhum' : listAdapters().map((a) => a.label).join(', ')}.</Body>
        <Body dim>A busca de novos aparelhos e o pareamento são feitos pela tela do próprio Android (botão acima).</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.sm, marginTop: space.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  addr: { color: colors.textDim, fontSize: 12, fontFamily: 'monospace' },
});
