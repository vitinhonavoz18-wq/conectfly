/**
 * Conversa do carreto.
 *
 * Serve para o combinado do dia a dia: "estou na portaria", "a rua é
 * estreita, entra pela lateral". Fica registrado, então ninguém precisa
 * passar o telefone pessoal.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zcApi, zcErrorMessage } from "@/lib/zecarreto/client";

interface Message {
  id: string;
  sender_profile_id: string | null;
  is_system: boolean;
  body: string;
  created_at: string;
}

export function ZcChat({
  rideId,
  myProfileId,
  disabled,
}: {
  rideId: string;
  myProfileId: string;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setMessages(await zcApi<Message[]>(`/rides/${rideId}/messages`));
    } catch {
      // A conversa não é o principal da tela: falhar aqui não atrapalha.
    }
  }

  useEffect(() => {
    load();
    // Enquanto o tempo real não está ligado nesta tela, uma conferida
    // periódica resolve — é barato e não trava nada.
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await zcApi(`/rides/${rideId}/messages`, { method: "POST", body: { body: text.trim() } });
      setText("");
      await load();
    } catch (error) {
      toast.error(zcErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <p className="border-b border-neutral-100 px-4 py-3 font-semibold">Conversa</p>

      <div className="max-h-64 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhuma mensagem ainda. Combine aqui os detalhes da retirada.
          </p>
        )}
        {messages.map((message) => {
          const meu = message.sender_profile_id === myProfileId;
          if (message.is_system) {
            return (
              <p key={message.id} className="text-center text-xs text-neutral-500">
                {message.body}
              </p>
            );
          }
          return (
            <div key={message.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
              <span
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                  meu ? "bg-amber-400 text-neutral-900" : "bg-neutral-100 text-neutral-900",
                )}
              >
                {message.body}
                <span className="mt-0.5 block text-[10px] opacity-60">
                  {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!disabled && (
        <form onSubmit={enviar} className="flex gap-2 border-t border-neutral-100 p-3">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Escreva uma mensagem"
            maxLength={1000}
          />
          <Button type="submit" size="icon" disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}
