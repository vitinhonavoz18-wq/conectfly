import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * ID do projeto no expo.dev. Não é segredo, mas é da SUA conta — por isso fica
 * vazio até você rodar `npx eas-cli init` e colar aqui o id mostrado (ver README §4).
 * A variável de ambiente EAS_PROJECT_ID, se existir, tem prioridade.
 */
const EAS_PROJECT_ID = '';

const projectId = process.env.EAS_PROJECT_ID || EAS_PROJECT_ID || undefined;
// Usuário/organização no expo.dev (opcional).
const owner = process.env.EXPO_OWNER || undefined;
// Nenhuma chave secreta deve ser colocada em variáveis EXPO_PUBLIC_*: elas vão para dentro do APK.

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Jarvis',
  slug: 'jarvis',
  ...(owner ? { owner } : {}),
  scheme: 'jarvis',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#111418',
  android: {
    package: 'com.conectfly.jarvis',
    versionCode: 1,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#111418',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
    // Permissões que bibliotecas costumam adicionar e o Jarvis não usa.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.QUERY_ALL_PACKAGES',
      'android.permission.CALL_PHONE',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#111418',
        image: './assets/splash-icon.png',
        imageWidth: 140,
      },
    ],
    'expo-secure-store',
    './plugins/withJarvisAndroid',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...(projectId ? { eas: { projectId } } : {}),
  },
});
