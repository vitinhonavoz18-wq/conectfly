/**
 * Avaliações.
 * Só quem participou do carreto avalia, só depois de concluído, e só uma
 * vez por lado. A média do avaliado se atualiza sozinha no banco.
 */

import { zcAdmin } from "../db/client";
import { fromPostgresError, zcError } from "../errors";
import type { ZcRatingDirection } from "../domain/enums";
import type { ZcRatingRow } from "../db/types";
import type { ZcCaller } from "../http/auth";

export async function rateRide(
  caller: ZcCaller,
  rideId: string,
  input: { direction: ZcRatingDirection; stars: number; comment?: string; tags?: string[] },
): Promise<ZcRatingRow> {
  const db = zcAdmin();
  const { data: ride } = await db.from("zc_rides").select("*").eq("id", rideId).maybeSingle();
  if (!ride) throw zcError.notFound("Carreto não encontrado.");
  if (ride.status !== "completed") {
    throw zcError.conflict("Só dá para avaliar depois que o carreto é concluído.");
  }
  if (!ride.driver_id) throw zcError.conflict("Este carreto não teve motorista.");

  const { data: driver } = await db
    .from("zc_drivers")
    .select("profile_id")
    .eq("id", ride.driver_id)
    .maybeSingle();
  if (!driver) throw zcError.notFound("Motorista do carreto não encontrado.");

  let rateeProfileId: string;
  if (input.direction === "client_to_driver") {
    if (ride.customer_profile_id !== caller.profileId && !caller.isAdmin) {
      throw zcError.forbidden("Só o cliente do carreto avalia o motorista.");
    }
    rateeProfileId = driver.profile_id;
  } else {
    if (ride.driver_id !== caller.driverId && !caller.isAdmin) {
      throw zcError.forbidden("Só o motorista do carreto avalia o cliente.");
    }
    rateeProfileId = ride.customer_profile_id;
  }

  const { data, error } = await db
    .from("zc_ratings")
    .insert({
      ride_id: rideId,
      direction: input.direction,
      rater_profile_id: caller.profileId,
      ratee_profile_id: rateeProfileId,
      stars: input.stars,
      comment: input.comment ?? null,
      tags: input.tags ?? [],
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw zcError.conflict("Você já avaliou este carreto.");
    throw fromPostgresError(error);
  }
  return data;
}

export async function listRatingsFor(profileId: string, limit = 20, offset = 0) {
  const { data, error } = await zcAdmin()
    .from("zc_ratings")
    .select("*")
    .eq("ratee_profile_id", profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw fromPostgresError(error);
  return data ?? [];
}

export async function getRideRatings(rideId: string) {
  const { data, error } = await zcAdmin().from("zc_ratings").select("*").eq("ride_id", rideId);
  if (error) throw fromPostgresError(error);
  return data ?? [];
}
