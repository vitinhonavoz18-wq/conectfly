#!/usr/bin/env bash
# Varredura básica de segurança do repositório (rode antes de cada commit/deploy).
#  1. .env e arquivos de credenciais fora do git
#  2. nenhum segredo com formato conhecido nos arquivos versionáveis
#  3. workflows sem credenciais embutidas (validador)
#  4. portas do docker só em 127.0.0.1
#  5. dependências de produção sem vulnerabilidade alta/crítica (npm audit)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=1; }

echo "1) arquivos de segredo fora do git"
tracked="$(git ls-files -- . 2>/dev/null; git ls-files --others --exclude-standard -- . 2>/dev/null)"
if echo "$tracked" | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | grep -v 'tests/e2e/e2e\.env$' >/dev/null; then
  bad "arquivo .env seria versionado: $(echo "$tracked" | grep -E '(^|/)\.env' | grep -v example | tr '\n' ' ')"
else ok ".env não versionado (só .env.example e o e2e.env de valores fictícios)"; fi
if echo "$tracked" | grep -Ei '(^|/)(credentials[^/]*\.json|.*\.secret|.*\.pem|.*\.key)$' >/dev/null; then bad "arquivo de credencial/chave versionável"; else ok "nenhum arquivo de credencial/chave"; fi

echo "2) padrões de segredo"
patterns='sk-(proj-)?[A-Za-z0-9_-]{20,}|EAA[A-Za-z0-9]{30,}|IGQ[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}'
files="$(echo "$tracked" | grep -vE '^(node_modules|dist|\.tmp)/|package-lock\.json$|\.(png|jpe?g|woff2?)$')"
hits="$(echo "$files" | xargs -r grep -EnI "$patterns" 2>/dev/null || true)"
if [ -n "$hits" ]; then bad "possível segredo encontrado:"; echo "$hits" | head -20; else ok "nenhum segredo com formato conhecido"; fi

echo "3) workflows"
if node scripts/validate-workflows.mjs >/dev/null 2>&1; then ok "workflows sem credencial embutida e sem segredo"; else bad "validador de workflows falhou (rode npm run workflows:validate)"; fi

echo "4) portas expostas"
exposed="$(grep -nE '^\s*-\s*"[0-9]+:[0-9]+"|^\s*-\s*"\$\{[A-Z_]+(:-[0-9]+)?\}:[0-9]+"' docker-compose.yml || true)"
if [ -n "$exposed" ]; then bad "porta publicada em todas as interfaces:"; echo "$exposed"; else ok "portas publicadas só em 127.0.0.1"; fi

echo "5) dependências de produção (npm audit --omit=dev)"
if audit="$(npm audit --omit=dev --audit-level=high --json 2>/dev/null)"; then
  ok "sem vulnerabilidade alta/crítica"
else
  summary="$(echo "$audit" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;console.log(JSON.stringify(v))}catch{console.log("sem resposta do registro npm")}})')"
  if echo "$summary" | grep -q '"high":0' && echo "$summary" | grep -q '"critical":0'; then ok "sem vulnerabilidade alta/crítica ($summary)"; else bad "npm audit: $summary"; fi
fi

[ $fail -eq 0 ] && echo "RESULTADO: OK" || echo "RESULTADO: PROBLEMAS ENCONTRADOS"
exit $fail
