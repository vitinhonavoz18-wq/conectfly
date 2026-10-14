# Jarvis — assistente por voz para Android

Aplicativo Android em português que conversa por voz e executa ações **autorizadas** no
celular: abrir apps, links, configurações, mapa, discador, compartilhar texto, controlar
mídia, consultar Bluetooth e — com sua permissão explícita — navegar dentro de apps que
você escolher.

A inteligência (IA) vem do [OpenJarvis](https://github.com/open-jarvis/OpenJarvis),
rodando no seu computador ou servidor. O celular **não** guarda chave de IA nenhuma.

---

## 1. Como as peças se encaixam

Pense num restaurante:

| Peça | No restaurante | Onde fica |
|---|---|---|
| **App Jarvis** (`jarvis/`) | O garçom: ouve o pedido, confere as regras da casa e serve | No celular (APK) |
| **Gateway** (`jarvis/gateway/`) | O porteiro da cozinha: só deixa entrar garçom com crachá válido, controla a fila e pode cassar um crachá | No computador |
| **OpenJarvis** | O chef: entende o pedido e sugere o que fazer | No computador/servidor |

O chef **só sugere**. Quem decide se pode, pede confirmação e executa é o garçom (o
celular). Mesmo que o chef "mande" fazer algo proibido, o garçom recusa — as regras estão
gravadas no app, não no texto que vai para a IA.

```
Celular (Jarvis) ──Wi‑Fi/HTTPS──> Gateway ──localhost──> OpenJarvis ──> modelo de IA
   ▲ valida, confirma, executa         ▲ pareamento, revogação, limites
```

**Sem o computador ligado**, o app abre e os comandos diretos continuam funcionando
(“abra o YouTube”, “abra as configurações de Bluetooth”, “ligar para 11 9999‑0000”,
“pausar”). Só a conversa livre com a IA para — e o app avisa isso na tela.

---

## 2. O que funciona, o que não funciona e o que falta

### Funciona (implementado e coberto por testes automáticos ou compilação)

- Telas: Início, Conversa, Ações e histórico, Dispositivos, Configurações.
- Botão **Falar com Jarvis** (toque para falar), texto reconhecido visível e editável, campo
  de texto sempre disponível, botão **Interromper** (para fala, escuta e ação).
- Reconhecimento de fala em pt‑BR pelo serviço do próprio Android (módulo Kotlin) e
  resposta falada (TTS). Trata silêncio, “não entendi”, microfone negado, serviço
  indisponível e falta de internet. O microfone é liberado ao terminar, cancelar ou sair do app.
- Comandos locais em português, sem internet: abrir app, abrir site, abrir configurações
  (Bluetooth, Wi‑Fi, acessibilidade, som, tela, bateria, localização, notificações),
  abrir mapa com endereço, abrir discador com número, preparar texto para compartilhar,
  controlar mídia, consultar permissões.
- Conversa com IA via gateway + OpenJarvis, com ferramentas (“function calling”).
- Navegação em outros apps por **serviço de acessibilidade** (ativação manual), só em apps
  que você marcar, com o ciclo *observar → propor → validar → executar → verificar*,
  limite de passos, tempo máximo, cancelamento e detecção de repetição.
- Confirmação obrigatória, mostrando app, botão, destinatário e conteúdo exatos, antes de
  tocar em botões como Enviar, Comprar, Pagar, Publicar, Excluir.
- Bloqueios fixos: nunca lê nem preenche senha, código de verificação, cartão ou PIX;
  apps de banco, pagamento, autenticação, loja e as configurações do Android não podem ser
  automatizados.
- Proteção contra repetição: cada ação tem identificador e prazo; ação repetida (mesmo
  id) nunca roda duas vezes, nem depois de reabrir o app; a mesma mensagem reenviada com
  outro id pede confirmação de novo.
- Bluetooth: disponibilidade (clássico e BLE separados), ligado/desligado, permissão,
  lista de pareados com tipo, abrir tela de pareamento do Android, pedir para ligar.
- Gateway: pareamento por código de uso único, token por aparelho (guardado só como
  hash), revogação pelo celular ou pelo computador, limite de requisições, HTTPS opcional,
  logs sem conteúdo nem tokens.
- Configurações: URL do backend, pareamento, testar conexão, status/erro em português,
  desconectar, apagar histórico, revogar permissões, escolher apps autorizados.

### Não funciona / limitações reais

- **IA offline**: não. A conversa livre depende do computador com OpenJarvis ligado.
- **Reconhecimento de voz offline**: depende do aparelho. A tela de Configurações mostra se
  o aparelho oferece; o app não promete.
- **Palavra de ativação e escuta contínua**: implementadas na versão 1.1 (ver §2.1), com as
  limitações descritas lá.
- **Controle universal de apps**: alguns apps não expõem seus botões para acessibilidade
  ou bloqueiam automação. Nesses casos o Jarvis para e avisa.
- **Ligar/desligar Bluetooth ou Wi‑Fi sozinho**: o Android moderno não permite a apps
  comuns; o Jarvis abre a tela certa e você toca.
- **Controle de mídia**: o comando é enviado ao player ativo; o Android não confirma se o
  player obedeceu, e o app diz isso.
- **Controlar aparelhos Bluetooth**: nenhum adaptador vem instalado. Estar pareado não
  basta — cada equipamento exige protocolo próprio (ver `src/core/bluetoothAdapters.ts`).
- **Ligar para contatos pelo nome**: ainda não; só por número.
- **Streaming (resposta aparecendo palavra por palavra)**: o OpenJarvis oferece, mas esta
  versão usa resposta completa para tratar as ferramentas com segurança.
- A qualidade das decisões depende do modelo configurado no OpenJarvis. Modelos locais
  pequenos às vezes não usam ferramentas corretamente; o app recusa propostas inválidas e
  mostra o motivo.

### Pendências reais desta entrega

- Primeiro APK (perfil preview) gerado com sucesso no EAS em 14/10/2026:
  https://expo.dev/accounts/vitinho157s-team/projects/jarvis/builds/379eaf96-c81f-496b-bd3a-84b1e3ae3ad1
- Nenhum teste foi feito em **celular físico** ainda. Roteiro em
  [`docs/ROTEIRO-DE-TESTE.md`](docs/ROTEIRO-DE-TESTE.md).
- A compilação Android completa (Gradle) não pôde rodar aqui (repositório do Google
  bloqueado). O código Kotlin foi compilado com o compilador Kotlin oficial contra a
  biblioteca do Android 16 — sem erros —, mas o build final acontece no EAS.

---

## 2.1 Novidades: IA na nuvem, “Jarvis” sempre ligado e assistir junto

### Cérebro na nuvem (sem precisar do PC)
- Função `jarvis-brain` publicada no Supabase (projeto SITECREATORFLY, isolada: não usa
  tabelas nem dados do site). Endereço:
  `https://glyausrubnpkodgxosdj.supabase.co/functions/v1/jarvis-brain`
- IA: Google Gemini (modelo “flash” estável mais novo disponível para a chave).
- Mesma API do gateway do PC: o app funciona com qualquer um dos dois.
- Segredos (Supabase → Edge Functions → Secrets): `GEMINI_API_KEY` e
  `JARVIS_PAIRING_CODE` (código que você inventa, mínimo 8 letras/números).
  Opcionais: `GEMINI_MODEL`, `JARVIS_REVOKED_DEVICES` (ids separados por vírgula),
  `JARVIS_TOKEN_VERSION` (trocar derruba todos os celulares), `JARVIS_RATE_LIMIT_PER_MIN`.
- Código: `cloud/jarvis-brain/` (testes: `npm run test:cloud`). Após mudar regras
  compartilhadas: `node cloud/sync-shared.mjs`.
- **Privacidade:** no plano gratuito do Gemini o Google pode usar o conteúdo enviado
  (perguntas e imagens da tela) para melhorar seus produtos. Use o plano pago ou o
  OpenJarvis no PC para conteúdo sensível.

### “Jarvis” sempre ligado
- Detector Picovoice Porcupine com a palavra pronta “Jarvis”, rodando no celular
  (nenhum áudio sai do aparelho até você chamar). Exige AccessKey gratuita de
  console.picovoice.ai, salva no armazenamento seguro.
- Serviço em primeiro plano com notificação fixa (exigência do Android). Só liga com o
  app aberto na tela; ao reabrir o app, religa sozinho se estava ativo.
- Conversa contínua: depois de “Jarvis”, ele continua ouvindo até você se despedir
  (“valeu bonitão”, “obrigado Jarvis”, “falou”, “tchau”, “é isso”, “tamo junto”…),
  até concluir uma tarefa pedida ou até você ficar em silêncio.
- Limitações reais: a palavra é treinada em inglês (funciona com “Jarvis” dito em
  português, mas pode errar); vídeos falando “Jarvis” podem disparar; alguns fabricantes
  (Xiaomi, Samsung…) matam apps em segundo plano — libere o Jarvis na otimização de
  bateria; se o Android encerrar o app, a escuta só volta ao abri-lo.

### Assistir junto
- Captura de tela (MediaProjection) só depois do aviso do próprio Android, com ícone de
  transmissão e notificação fixa. Guarda apenas o quadro mais recente na memória.
- Uma imagem é enviada só junto de uma pergunta sua — quando ela fala da tela (“esse
  vídeo”, “o que é isso”) ou quando outro app está na frente.
- Vê só aquele instante, **não ouve o áudio do vídeo**. Apps protegidos (bancos, alguns
  streamings) aparecem pretos. Apps bloqueados pela política nunca são enviados.
- A autorização acaba quando você desliga ou o Android encerra (ex.: ao bloquear a tela,
  dependendo da versão); aí é preciso ligar de novo.

### Gerar APK sem o PC (GitHub Actions)
- Arquivo `.github/workflows/jarvis-apk.yml`. Requer o segredo `EXPO_TOKEN` no GitHub
  (Settings → Secrets and variables → Actions).
- Dispara em commits que alterem `jarvis/` com `[apk]` na mensagem (ou manualmente na
  aba Actions, quando o arquivo estiver no branch principal). O resumo do job mostra o
  link do build e do APK.

---

## 3. Estrutura

```
jarvis/
├── app.config.ts            # nome, pacote com.conectfly.jarvis, permissões, plugins
├── eas.json                 # perfis development / preview (APK) / production (AAB)
├── plugins/withJarvisAndroid.js   # config plugin: permissões, <queries>, rede local
├── modules/jarvis-device/   # módulo nativo Kotlin (Expo Modules)
│   ├── android/.../JarvisDeviceModule.kt        # apps, links, configurações, mapa, discador, compartilhar, mídia
│   ├── android/.../JarvisSpeechModule.kt        # reconhecimento de fala (SpeechRecognizer)
│   ├── android/.../JarvisBluetoothModule.kt     # Bluetooth clássico e BLE
│   ├── android/.../JarvisAccessibilityService.kt# serviço de acessibilidade
│   └── android/.../JarvisAccessibilityModule.kt # ponte com o serviço
├── src/app/                 # telas (Expo Router)
├── src/core/                # regras: contrato, validação, política, anti-repetição, comandos locais
├── src/services/            # backend, executor, voz, armazenamento
├── tests/                   # testes das regras (node --test)
└── gateway/                 # gateway Node.js para o OpenJarvis (+ testes)
```

A pasta `android/` **não** fica no repositório: ela é gerada a cada build. Tudo que é
nativo está no módulo `modules/jarvis-device` e no plugin, então sobrevive à regeneração.

---

## 4. Gerar o APK (EAS Build)

> O EAS Build **compila o app** na nuvem do Expo. Ele **não hospeda** o gateway nem o
> OpenJarvis — esses continuam no seu computador/servidor.

No seu computador (Node.js 20 ou mais novo):

```bash
cd jarvis
npm install
npx eas-cli@latest login          # entre com sua conta do expo.dev
npx eas-cli@latest init           # cria o projeto no expo.dev e mostra o projectId
```

Como a configuração é `app.config.ts` (dinâmica), o `eas init` mostra o `projectId` em vez
de gravá-lo sozinho. Abra `jarvis/app.config.ts` e cole o id na linha:

```ts
const EAS_PROJECT_ID = 'cole-aqui-o-id';
```

Salve, faça commit e siga.

Depois gere o APK instalável:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Ao terminar, o terminal e o site expo.dev mostram o link do build e um QR code para baixar
o APK. Esse APK já contém o JavaScript, abre sem Expo Go e sem Metro, e inclui os módulos
Kotlin e o serviço de acessibilidade.

Outros perfis:

- `development`: APK com `expo-dev-client`, para desenvolver (`npm start` no computador).
- `production`: pacote AAB para a Play Store (exige revisão das políticas de
  acessibilidade da Google antes de publicar).

Verificações antes do build: `npm run check` (tipos + lint + testes) e
`npx expo-doctor`.

---

## 5. Ligar o OpenJarvis e o gateway (no computador)

### 5.1 OpenJarvis

Siga a [instalação oficial](https://open-jarvis.github.io/OpenJarvis/getting-started/install/).
Pelo código-fonte:

```bash
git clone https://github.com/open-jarvis/OpenJarvis.git
cd OpenJarvis
uv sync --extra server
uv run jarvis auth create-key               # gera a chave e mostra na tela
uv run jarvis serve --host 127.0.0.1 --port 8000
```

Use um modelo que suporte ferramentas (function calling) no motor configurado (ex.: Ollama).
O OpenJarvis fica preso ao `127.0.0.1`: só o gateway, na mesma máquina, fala com ele.

### 5.2 Gateway

```bash
cd jarvis/gateway
npm install
cp .env.example .env        # coloque a chave em OPENJARVIS_API_KEY
npm start
```

Ele mostra o endereço para usar no celular, por exemplo `http://192.168.0.10:8787`.

### 5.3 Parear o celular

```bash
npm run pair      # mostra um código como ABCD-2345, válido por 10 minutos, uso único
```

No app: **Ajustes → Conexão com o OpenJarvis** → endereço do gateway → **Salvar e
testar** → digite o código → **Autenticar este celular**.

Para ver e revogar aparelhos:

```bash
npm run devices
npm run revoke -- <id>
```

O botão **Desconectar este celular** no app também revoga o acesso no gateway.

---

## 6. Conectar pelo Wi‑Fi de casa

- Celular e computador precisam estar **na mesma rede Wi‑Fi**.
- Use o **IP do computador** (ex.: `192.168.0.10`), não `localhost`.
- **Por que não `localhost`?** No celular, “localhost” é o próprio celular — como ligar
  para o ramal “0” de dentro do restaurante e cair na sua própria mesa, não na cozinha.
- O app aceita `http://` apenas para endereços da rede local (192.168.x, 10.x, 172.16–31.x,
  100.64–127.x do Tailscale, `.local`). Fora disso, exige `https://`.
- Se não conectar: confira o firewall do computador (libere a porta 8787).

## 7. Acesso fora de casa (remoto, com HTTPS)

Nunca exponha o gateway pela internet em `http://`. Opções:

1. **Tailscale** (mais simples): instale no computador e no celular; use o IP `100.x.y.z`
   do computador. O tráfego já vai criptografado entre os aparelhos.
2. **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:8787` gera um
   endereço `https://…`; use-o no app.
3. **Proxy reverso com certificado** (Caddy/Nginx) em um servidor seu, apontando para o
   gateway.
4. HTTPS direto no gateway: defina `TLS_CERT_FILE` e `TLS_KEY_FILE` no `.env` (o
   certificado precisa ser confiável para o Android).

Em todos os casos o gateway continua exigindo o pareamento de cada celular.

---

## 8. Segurança e privacidade

- **Chaves de IA** ficam só no computador (`OPENJARVIS_API_KEY` no `gateway/.env`, que
  não vai para o git). Nada secreto usa `EXPO_PUBLIC_*`.
- **Token do celular** fica no armazenamento seguro do Android (SecureStore). No gateway,
  só o hash dele é guardado.
- **Regras no executor local**: toda ação passa por validação (campos extras e esquemas
  de link perigosos são recusados), registro anti-repetição, política e confirmação — no
  celular. O backend não tem como desligar a confirmação.
- **Telas de outros apps** e resultados de ferramentas são enviados ao modelo marcados
  como *dados não confiáveis*. Campos de senha são mascarados antes de sair do aparelho.
  Apps não autorizados nem são lidos.
- **Histórico** guarda só o tipo de ação e o tamanho dos textos, nunca o conteúdo
  compartilhado ou digitado. Pode ser apagado em Ajustes.
- Sem captura contínua de tela, sem gestos por coordenada, sem shell.

---

## 9. Evolução futura (documentada, não implementada)

- **Ouvir o áudio do vídeo** no modo assistir junto (AudioPlaybackCapture), quando o app
  de vídeo permitir.
- **Adaptadores Bluetooth** para equipamentos com protocolo documentado
  (`src/core/bluetoothAdapters.ts`).
- **Respostas em streaming** (o OpenJarvis já oferece SSE em `/v1/chat/completions`).
- **Contatos** (ligar/mandar mensagem por nome) com permissão de contatos.

---

## 10. Desenvolvimento

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (expo lint)
npm test            # testes das regras (validação, política, anti-repetição, navegação)
cd gateway && npm test && npm run typecheck
npx expo-doctor
```

Para desenvolver com recarga rápida: gere o perfil `development`
(`npx eas-cli@latest build -p android --profile development`), instale no celular e rode
`npm start` no computador.

Não rode `npx expo prebuild --clean` esperando preservar edições feitas à mão em
`android/`: não há nenhuma — tudo nativo está em `modules/` e `plugins/`.

Licenças e referência ao OpenJarvis: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
