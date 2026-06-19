"use server";

import { revalidatePath } from "next/cache";
import {
  shiftWindowFitsAvailabilitySlot,
  toProfileAvailabilitySaveError,
  validateShiftPreferenceDimensions,
} from "@schichtwerk/database";
import type {
  Location,
  LocationArea,
  ProfileShiftPreference,
  Qualification,
} from "@schichtwerk/types";
import { getDatabase } from "@/lib/db";
import { requireManager } from "@/lib/manager";

export type ProfileShiftPreferenceActionResult =
  | { ok: true; preferences?: ProfileShiftPreference[] }
  | { ok: false; error: string };

export type ProfileShiftPreferenceFormOptionsResult =
  | {
      ok: true;
      locations: Location[];
      areas: LocationArea[];
      qualifications: Qualification[];
    }
  | { ok: false; error: string };

type ShiftPreferencePlacementInput = {
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
};

type ShiftPreferenceSaveInput = ShiftPreferencePlacementInput & {
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
};

const PREFERENCE_OUTSIDE_AVAILABILITY_ERROR =
  "Wunschzeit liegt außerhalb der Verfügbarkeit.";
const PREFERENCE_NO_AVAILABILITY_ERROR =
  "Für diesen Wochentag ist keine Verfügbarkeit hinterlegt.";

async function assertPreferenceWithinAvailability(
  organizationId: string,
  profileId: string,
  weekday: number,
  start_time: string,
  end_time: string
): Promise<void> {
  const db = await getDatabase();
  const availability = await db.listProfileRecurringAvailability(
    organizationId,
    profileId
  );
  const daySlots = availability.filter((slot) => slot.weekday === weekday);
  if (daySlots.length === 0) {
    throw new Error(PREFERENCE_NO_AVAILABILITY_ERROR);
  }

  const fits = daySlots.some((slot) =>
    shiftWindowFitsAvailabilitySlot(
      start_time,
      end_time,
      slot.start_time,
      slot.end_time
    )
  );
  if (!fits) {
    throw new Error(PREFERENCE_OUTSIDE_AVAILABILITY_ERROR);
  }
}

async function resolveShiftPreferencePlacement(
  organizationId: string,
  profileId: string,
  input: ShiftPreferencePlacementInput
): Promise<{
  location_id: string | null;
  location_area_id: string | null;
  qualification_id: string | null;
}> {
  const db = await getDatabase();
  const locations = await db.listLocations(organizationId);
  const locationIds = new Set(locations.map((location) => location.id));

  let locationId = input.location_id ?? null;
  let areaId = input.location_area_id ?? null;
  const qualificationId = input.qualification_id ?? null;

  if (areaId) {
    let matchedArea: LocationArea | undefined;
    for (const location of locations) {
      const areas = await db.listLocationAreas(location.id);
      matchedArea = areas.find((area) => area.id === areaId);
      if (matchedArea) break;
    }
    if (!matchedArea) {
      throw new Error("Bereich nicht gefunden");
    }
    if (locationId && matchedArea.location_id !== locationId) {
      throw new Error("Bereich gehört nicht zum gewählten Standort");
    }
    locationId = matchedArea.location_id;
  }

  if (locationId && !locationIds.has(locationId)) {
    throw new Error("Standort nicht gefunden");
  }

  if (qualificationId) {
    const qualifications = await db.listProfileQualifications(
      organizationId,
      profileId
    );
    if (!qualifications.some((qualification) => qualification.id === qualificationId)) {
      throw new Error("Tätigkeit nicht beim Profil hinterlegt");
    }
  }

  return {
    location_id: locationId,
    location_area_id: areaId,
    qualification_id: qualificationId,
  };
}

function buildPreferencePayload(
  input: ShiftPreferenceSaveInput,
  placement: Awaited<ReturnType<typeof resolveShiftPreferencePlacement>>
) {
  const dimensions = validateShiftPreferenceDimensions({
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    ...placement,
  });
  if (!dimensions.ok) {
    throw new Error(dimensions.error);
  }

  return {
    weekday: dimensions.hasTime ? input.weekday! : null,
    start_time: dimensions.hasTime ? input.start_time! : null,
    end_time: dimensions.hasTime ? input.end_time! : null,
    ...placement,
  };
}

export async function fetchProfileShiftPreferenceFormOptions(
  profileId: string
): Promise<ProfileShiftPreferenceFormOptionsResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const [locations, qualifications] = await Promise.all([
      db.listLocations(organizationId),
      db.listProfileQualifications(organizationId, profileId),
    ]);
    const areaGroups = await Promise.all(
      locations.map((location) => db.listLocationAreas(location.id))
    );

    return {
      ok: true,
      locations,
      areas: areaGroups.flat(),
      qualifications,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function fetchProfileShiftPreferences(
  profileId: string
): Promise<ProfileShiftPreferenceActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }
    const preferences = await db.listProfileShiftPreferences(
      organizationId,
      profileId
    );
    return { ok: true, preferences };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Laden fehlgeschlagen",
    };
  }
}

export async function createProfileShiftPreference(input: {
  profileId: string;
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
}): Promise<ProfileShiftPreferenceActionResult> {
  if (input.weekday != null) {
    return createProfileShiftPreferences({
      profileId: input.profileId,
      weekdays: [input.weekday],
      start_time: input.start_time,
      end_time: input.end_time,
      location_id: input.location_id,
      location_area_id: input.location_area_id,
      qualification_id: input.qualification_id,
    });
  }

  return createProfileShiftPreferences({
    profileId: input.profileId,
    weekdays: [],
    start_time: input.start_time,
    end_time: input.end_time,
    location_id: input.location_id,
    location_area_id: input.location_area_id,
    qualification_id: input.qualification_id,
  });
}

export async function createProfileShiftPreferences(input: {
  profileId: string;
  weekdays: number[];
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
}): Promise<ProfileShiftPreferenceActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    const profile = await db.getProfileById(input.profileId);
    if (!profile || profile.organization_id !== organizationId) {
      return { ok: false, error: "Profil nicht gefunden" };
    }

    const placement = await resolveShiftPreferencePlacement(
      organizationId,
      input.profileId,
      input
    );

    const dimensions = validateShiftPreferenceDimensions({
      weekday: input.weekdays.length > 0 ? input.weekdays[0] : null,
      start_time: input.start_time,
      end_time: input.end_time,
      ...placement,
    });
    if (!dimensions.ok) {
      return { ok: false, error: dimensions.error };
    }

    if (dimensions.hasTime) {
      const weekdaysToSave = [...new Set(input.weekdays)].sort((a, b) => a - b);
      if (weekdaysToSave.length === 0) {
        return {
          ok: false,
          error: "Bitte mindestens einen Wochentag auswählen.",
        };
      }

      for (const weekday of weekdaysToSave) {
        await assertPreferenceWithinAvailability(
          organizationId,
          input.profileId,
          weekday,
          input.start_time!,
          input.end_time!
        );
        await db.insertProfileShiftPreference(organizationId, input.profileId, {
          weekday,
          start_time: input.start_time,
          end_time: input.end_time,
          ...placement,
        });
      }
    } else {
      await db.insertProfileShiftPreference(organizationId, input.profileId, {
        weekday: null,
        start_time: null,
        end_time: null,
        ...placement,
      });
    }

    const preferences = await db.listProfileShiftPreferences(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, preferences };
  } catch (e) {
    return { ok: false, error: toProfileAvailabilitySaveError(e) };
  }
}

export async function updateProfileShiftPreference(input: {
  profileId: string;
  preferenceId: string;
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  location_id?: string | null;
  location_area_id?: string | null;
  qualification_id?: string | null;
}): Promise<ProfileShiftPreferenceActionResult> {
  try {
    const { organizationId } = await requireManager();
    const placement = await resolveShiftPreferencePlacement(
      organizationId,
      input.profileId,
      input
    );
    const payload = buildPreferencePayload(input, placement);

    if (payload.weekday != null && payload.start_time && payload.end_time) {
      await assertPreferenceWithinAvailability(
        organizationId,
        input.profileId,
        payload.weekday,
        payload.start_time,
        payload.end_time
      );
    }

    const db = await getDatabase();
    await db.updateProfileShiftPreference(
      organizationId,
      input.profileId,
      input.preferenceId,
      payload
    );
    const preferences = await db.listProfileShiftPreferences(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, preferences };
  } catch (e) {
    return { ok: false, error: toProfileAvailabilitySaveError(e) };
  }
}

export async function deleteProfileShiftPreference(input: {
  profileId: string;
  preferenceId: string;
}): Promise<ProfileShiftPreferenceActionResult> {
  try {
    const { organizationId } = await requireManager();
    const db = await getDatabase();
    await db.deleteProfileShiftPreference(
      organizationId,
      input.profileId,
      input.preferenceId
    );
    const preferences = await db.listProfileShiftPreferences(
      organizationId,
      input.profileId
    );
    revalidatePath("/dashboard");
    revalidatePath("/bereich-kalender");
    return { ok: true, preferences };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Löschen fehlgeschlagen",
    };
  }
}
