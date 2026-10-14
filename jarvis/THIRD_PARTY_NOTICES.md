# Avisos de terceiros

## OpenJarvis

- Projeto: https://github.com/open-jarvis/OpenJarvis
- Licença: Apache License 2.0
- Commit usado como referência: `7d16cd7b3781a3472502013463760ef6da22934f` (13/10/2026)

O Jarvis **não copia nem redistribui código do OpenJarvis**. O gateway (`gateway/`)
conversa com um servidor OpenJarvis instalado separadamente, usando a API HTTP pública
que ele expõe. As interfaces abaixo foram conferidas no código-fonte desse commit:

| Interface | Arquivo no OpenJarvis |
|---|---|
| `GET /health` | `src/openjarvis/server/routes.py` |
| `GET /v1/info` (`model`, `agent`, `engine`) | `src/openjarvis/server/routes.py` |
| `POST /v1/chat/completions` (formato OpenAI, `tools` → `tool_calls`) | `src/openjarvis/server/routes.py`, `models.py` |
| Autenticação `Authorization: Bearer <OPENJARVIS_API_KEY>` | `src/openjarvis/server/auth_middleware.py` |
| `jarvis serve --host --port`, `jarvis auth create-key` | `src/openjarvis/cli/serve.py`, `auth_cmd.py` |

Se você redistribuir o OpenJarvis junto com este projeto, inclua a licença Apache 2.0
e o arquivo NOTICE dele, conforme exigido por essa licença.

## Expo / React Native

Dependências instaladas pelo npm mantêm suas próprias licenças (em `node_modules/*/LICENSE`).
O projeto foi iniciado a partir do modelo `blank-typescript` do `create-expo-app`.
