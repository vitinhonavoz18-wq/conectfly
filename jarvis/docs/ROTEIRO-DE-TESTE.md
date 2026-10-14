# Roteiro de teste do Jarvis

## A. O que já foi verificado automaticamente (sem celular)

| Verificação | Comando | Resultado nesta entrega |
|---|---|---|
| Tipos TypeScript do app | `npm run typecheck` | sem erros |
| Lint do app | `npm run lint` | sem erros nem avisos |
| Regras: validação, política, anti-repetição, comandos locais, navegação, URL do backend | `npm test` | 39 testes, todos passando |
| Gateway: pareamento, revogação, limites, tradução de ferramentas, formato real do OpenJarvis (servidor simulado) | `cd gateway && npm test` | 10 testes, todos passando |
| Tipos do gateway | `cd gateway && npm run typecheck` | sem erros |
| Compatibilidade Expo | `npx expo-doctor` | 19/21; as 2 restantes exigem acesso a `exp.host`/React Native Directory, bloqueado no ambiente de desenvolvimento |
| Geração do projeto Android + plugin | `npx expo prebuild -p android` | manifesto com permissões, `<queries>` e rede local corretos; módulo `jarvis-device` reconhecido pelo autolinking (4 módulos) |
| Empacotamento do JavaScript para Android | `npx expo export -p android` | bundle Hermes gerado (3,3 MB) |
| Compilação do Kotlin | compilador Kotlin 2.1.20 contra a biblioteca do Android 16 (API 36) e as assinaturas do expo-modules-core 57 | sem erros nem avisos |
| Build Gradle completo / APK | `eas build -p android --profile preview` | **não executado** (expo.dev e repositório Maven do Google bloqueados no ambiente) |

Nada abaixo foi testado em aparelho ainda.

## B. Testes no celular físico (a fazer)

Anote ✅/❌ e o que apareceu na tela.

### 1. Iniciar sem backend
1. Com o gateway desligado, abra o app.
2. Esperado: abre normalmente; selo “Sem backend · comandos locais” ou “IA offline”.
3. Diga ou digite “Abra o YouTube”. Esperado: YouTube abre; histórico mostra “Concluída”.
4. Digite “qual a previsão do tempo?”. Esperado: aviso de que a conversa depende do backend.

### 2. Conectar ao backend real
1. No computador: OpenJarvis (`jarvis serve`), gateway (`npm start`), `npm run pair`.
2. No app: Ajustes → endereço `http://IP-DO-PC:8787` → Salvar e testar → código → Autenticar.
3. Esperado: “IA conectada” e o nome do modelo.
4. Teste também `http://localhost:8787`: o app deve recusar explicando o motivo.

### 3. Enviar mensagem por texto
- Digite “Olá, quem é você?”. Esperado: resposta em português na Conversa.

### 4. Falar e ouvir resposta
1. Toque em “Falar com Jarvis” (primeira vez: aceitar microfone).
2. Fale uma pergunta. Esperado: texto aparece enquanto fala; ao terminar, fica no campo para editar.
3. Toque Enviar. Esperado: resposta escrita e falada.
4. Durante a fala, toque “Interromper”. Esperado: a voz para na hora.
5. Toque em falar e fique em silêncio. Esperado: “Não ouvi nada…”, microfone liberado (ícone do Android some).

### 5. Abrir aplicativo por comando
- “Abra as configurações de Bluetooth”, “Abra o mapa com este endereço: Av. Paulista, 1000”,
  “ligar para 11 99999‑0000” (só abre o discador), “Prepare este texto para compartilhar: teste”.
- “Abra o app XYZ” (inexistente). Esperado: “Não encontrei o app…”.

### 6. Ativar e revogar acessibilidade
1. Ajustes → “Ativar nas configurações do Android” → ative “Jarvis – navegação assistida”.
2. Volte: status “ativo”. Marque um app simples (ex.: Agenda, Notas, YouTube).
3. Tente marcar um app de banco: deve aparecer “bloqueado por segurança”.
4. Desative na tela do Android: status volta a “desligado”.

### 7. Navegar em um app permitido
1. Com acessibilidade ativa e o app marcado, peça: “No YouTube, pesquise receitas de bolo”.
2. Esperado: o app abre, o Jarvis mostra “Passo 1…”, “Passo 2…”, e o resultado final.
3. Peça algo em app NÃO marcado. Esperado: recusa “não está autorizado”.
4. Em um app de mensagens marcado, peça para enviar uma mensagem. Esperado: antes do toque em
   “Enviar”, aparece a confirmação com destinatário e texto exatos. Toque “Cancelar” e confira
   que nada foi enviado.

### 8. Cancelar ação em andamento
- Durante uma navegação, toque “Interromper”. Esperado: “Navegação cancelada”, nenhum passo extra.

### 9. Negar uma permissão
- Negue o microfone. Esperado: aviso amarelo e o campo de texto continua funcionando.
- Negue “Dispositivos próximos” na tela Dispositivos. Esperado: lista de pareados indisponível com explicação.

### 10. Desconectar a internet durante uma tarefa
1. Envie uma pergunta e, logo em seguida, desligue o Wi‑Fi.
2. Esperado: mensagem de conexão perdida; ações já feitas não se repetem ao reconectar
   (confira em Ações e histórico).

### 11. Consultar dispositivos Bluetooth
1. Tela Dispositivos → Permitir acesso.
2. Esperado: estado clássico/BLE, ligado/desligado e pareados com tipo (clássico, BLE, ambos).
3. “Abrir Bluetooth do Android” abre a tela de pareamento do sistema.

### 12. Revogar acesso do celular
- No app: “Desconectar este celular”. No computador: `npm run devices` mostra “REVOGADO”.
- Ou revogue pelo computador (`npm run revoke -- <id>`) e toque “Testar conexão” no app:
  esperado “Acesso revogado…”.
