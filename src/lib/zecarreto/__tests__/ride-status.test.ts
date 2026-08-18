import { describe, expect, test } from "bun:test";
import { ZC_RIDE_STATUSES, ZC_RIDE_TERMINAL_STATUSES, type ZcRideStatus } from "../domain/enums";
import {
  actorCanTransition,
  canTransition,
  describeTransitionError,
  isTerminalRideStatus,
  nextStatuses,
  STATUS_LABELS,
  ZC_RIDE_TRANSITIONS,
} from "../domain/ride-status";

const HAPPY_PATH: ZcRideStatus[] = [
  "draft",
  "awaiting_payment",
  "searching_driver",
  "driver_assigned",
  "driver_to_pickup",
  "driver_arrived",
  "loading",
  "in_transit",
  "unloading",
  "completed",
];

describe("máquina de status da corrida", () => {
  test("o caminho feliz inteiro é permitido", () => {
    for (let i = 1; i < HAPPY_PATH.length; i += 1) {
      expect(canTransition(HAPPY_PATH[i - 1], HAPPY_PATH[i])).toBe(true);
    }
  });

  test("não dá para pular etapa", () => {
    expect(canTransition("draft", "in_transit")).toBe(false);
    expect(canTransition("searching_driver", "loading")).toBe(false);
    expect(canTransition("awaiting_payment", "completed")).toBe(false);
  });

  test("estados finais não andam mais", () => {
    for (const status of ZC_RIDE_TERMINAL_STATUSES) {
      expect(nextStatuses(status)).toHaveLength(0);
      expect(isTerminalRideStatus(status)).toBe(true);
      for (const target of ZC_RIDE_STATUSES) {
        expect(canTransition(status, target)).toBe(false);
      }
    }
  });

  test("dá para cancelar em qualquer etapa antes do fim", () => {
    for (const status of ZC_RIDE_STATUSES) {
      if (ZC_RIDE_TERMINAL_STATUSES.includes(status)) continue;
      expect(canTransition(status, "cancelled")).toBe(true);
    }
  });

  test("todo status tem transições e rótulo declarados", () => {
    for (const status of ZC_RIDE_STATUSES) {
      expect(ZC_RIDE_TRANSITIONS[status]).toBeDefined();
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });

  test("cliente não marca etapa de motorista", () => {
    expect(actorCanTransition("client", "driver_arrived", "loading")).toBe(false);
    expect(actorCanTransition("driver", "driver_arrived", "loading")).toBe(true);
    expect(actorCanTransition("admin", "driver_arrived", "loading")).toBe(true);
  });

  test("cliente pode cancelar; motorista pode devolver a corrida", () => {
    expect(actorCanTransition("client", "driver_assigned", "cancelled")).toBe(true);
    expect(actorCanTransition("driver", "driver_assigned", "searching_driver")).toBe(true);
    expect(actorCanTransition("client", "searching_driver", "driver_assigned")).toBe(false);
  });

  test("a mensagem de erro explica em português", () => {
    expect(describeTransitionError("draft", "in_transit")).toContain("Rascunho");
    expect(describeTransitionError("completed", "loading")).toContain("concluído");
  });
});
