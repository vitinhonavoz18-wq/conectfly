// Ponto de entrada da função Supabase "jarvis-brain" (Deno).
// Segredos: GEMINI_API_KEY e JARVIS_PAIRING_CODE (obrigatórios);
// GEMINI_MODEL, JARVIS_REVOKED_DEVICES, JARVIS_TOKEN_VERSION, JARVIS_RATE_LIMIT_PER_MIN (opcionais).
import { createBrain } from './brain.ts';

Deno.serve(createBrain({ env: (name) => Deno.env.get(name) }));
