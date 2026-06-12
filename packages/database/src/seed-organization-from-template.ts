import type { Industry } from "@schichtwerk/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Schema } from "./schema";
import {
  getIndustryTemplate,
  resolveIndustryTemplateLocations,
} from "./industry-templates";
import { seedDefaultAreaServiceHours } from "./utils";

export async function seedOrganizationFromIndustryTemplate(
  client: SupabaseClient,
  organizationId: string,
  orgName: string,
  industry: Industry
): Promise<void> {
  const template = getIndustryTemplate(industry);
  const locations = resolveIndustryTemplateLocations(template, orgName);

  let locationSortOrder = 0;
  for (const location of locations) {
    const { data: locationRow, error: locationError } = await client
      .from(Schema.tables.locations)
      .insert({
        organization_id: organizationId,
        name: location.name,
        sort_order: locationSortOrder,
      })
      .select("id")
      .single();

    if (locationError || !locationRow) {
      throw new Error(locationError?.message ?? "Standort konnte nicht angelegt werden");
    }

    locationSortOrder += 1;

    for (let areaIndex = 0; areaIndex < location.areas.length; areaIndex += 1) {
      const areaName = location.areas[areaIndex]!;
      const { data: areaRow, error: areaError } = await client
        .from(Schema.tables.locationAreas)
        .insert({
          location_id: locationRow.id as string,
          name: areaName,
          sort_order: areaIndex,
          planning_mode: "simple",
        })
        .select("id")
        .single();

      if (areaError || !areaRow) {
        throw new Error(areaError?.message ?? "Bereich konnte nicht angelegt werden");
      }

      await seedDefaultAreaServiceHours(client, areaRow.id as string);
    }
  }

  for (let index = 0; index < template.qualifications.length; index += 1) {
    const name = template.qualifications[index]!;
    const { error: qualificationError } = await client
      .from(Schema.tables.qualifications)
      .insert({
        organization_id: organizationId,
        name,
        sort_order: index,
      });

    if (qualificationError) {
      throw new Error(
        qualificationError.message ?? "Qualifikation konnte nicht angelegt werden"
      );
    }
  }
}
