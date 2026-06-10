"use client";



import { useState, useTransition } from "react";

import {

  createLocationArea,

  updateLocationArea,

} from "@/app/actions/location-areas";

import { fetchAreaShiftTemplates } from "@/app/actions/area-shift-templates";

import { saveLocationAreaServiceHours } from "@/app/actions/location-service-hours";

import { fetchLocationAreaServiceHours } from "@/app/actions/location-service-hours";

import {

  validateLocationAreaName,

  validateLocationAreaUniqueness,

  normalizeAreaPlanningMode,

  suggestServiceHoursFromTemplates,

  hasConfiguredServiceHours,

  shouldOfferServiceHoursFromTemplates,

  type SuggestedServiceHourSlot,

} from "@schichtwerk/database";

import type { AreaPlanningMode, LocationArea } from "@schichtwerk/types";

import { useTranslations } from "@/i18n/locale-provider";
import { cn } from "@/lib/cn";

import { AreaPlanningModeField } from "./area-planning-mode-field";

import { AreaPlanningModeServiceHoursDialog } from "./area-planning-mode-service-hours-dialog";

import {
  SETTINGS_MODAL_TITLE_CLASS,
  settingsModalBodyPaddingClass,
  settingsModalFooterClass,
  settingsModalHeaderPaddingClass,
  settingsNestedModalDialogClass,
  settingsNestedModalOverlayClass,
} from "./settings-list-ui";

import {

  Alert,

  Button,

  CheckIcon,

  CloseIcon,

  IconButton,

  Input,

  LabelMuted,

} from "@/components/ui";



type Props = {

  mode: "create" | "edit";

  locationId: string;

  area?: LocationArea;

  existingAreas: LocationArea[];

  onClose: () => void;

  onSaved: (createdId?: string) => void;

  onServiceHoursUpdated?: (areaId: string) => void;

};



type PendingModeSwitch = {

  suggestedRows: SuggestedServiceHourSlot[];

  hasExistingServiceHours: boolean;

  previousMode: AreaPlanningMode;

  newMode: AreaPlanningMode;

};



export function LocationAreaFormModal({

  mode,

  locationId,

  area,

  existingAreas,

  onClose,

  onSaved,

  onServiceHoursUpdated,

}: Props) {

  const t = useTranslations();

  const [pending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(area?.name ?? "");

  const [planningMode, setPlanningMode] = useState<AreaPlanningMode>(() =>

    normalizeAreaPlanningMode(area?.planning_mode)

  );

  const [modeSwitchDialog, setModeSwitchDialog] = useState<PendingModeSwitch | null>(

    null

  );



  async function persistArea(applyServiceHours?: SuggestedServiceHourSlot[]) {

    const nameCheck = validateLocationAreaName(name);

    if (!nameCheck.ok) {

      setError(nameCheck.error);

      return false;

    }



    const unique = validateLocationAreaUniqueness(existingAreas, {

      name: nameCheck.value,

      excludeId: mode === "edit" ? area?.id : undefined,

    });

    if (!unique.ok) {

      setError(unique.error);

      return false;

    }



    const result =

      mode === "create"

        ? await createLocationArea({

            locationId,

            name: nameCheck.value,

            planning_mode: planningMode,

          })

        : await updateLocationArea({

            id: area!.id,

            locationId,

            name: nameCheck.value,

            planning_mode: planningMode,

          });



    if (!result.ok) {

      setError(result.error);

      return false;

    }



    const areaId = mode === "create" ? result.id! : area!.id;



    if (applyServiceHours?.length) {

      const hoursResult = await saveLocationAreaServiceHours({

        locationId,

        locationAreaId: areaId,

        rows: applyServiceHours.map((row) => ({

          weekday: row.weekday,

          start_time: row.start_time,

          end_time: row.end_time,

        })),

      });

      if (!hoursResult.ok) {

        setError(hoursResult.error);

        return false;

      }

      onServiceHoursUpdated?.(areaId);

    }



    onSaved(mode === "create" ? areaId : undefined);

    onClose();

    return true;

  }



  function handleSubmit() {

    setError(null);

    const nameCheck = validateLocationAreaName(name);

    if (!nameCheck.ok) {

      setError(nameCheck.error);

      return;

    }



    const unique = validateLocationAreaUniqueness(existingAreas, {

      name: nameCheck.value,

      excludeId: mode === "edit" ? area?.id : undefined,

    });

    if (!unique.ok) {

      setError(unique.error);

      return;

    }



    startTransition(async () => {

      if (mode === "edit" && area) {

        const previousMode = normalizeAreaPlanningMode(area.planning_mode);

        if (previousMode !== planningMode) {

          const [templatesResult, hoursResult] = await Promise.all([

            fetchAreaShiftTemplates(locationId, area.id),

            fetchLocationAreaServiceHours(locationId, area.id),

          ]);



          const templates = templatesResult.ok ? templatesResult.templates ?? [] : [];

          if (

            shouldOfferServiceHoursFromTemplates({

              previousMode,

              newMode: planningMode,

              templates,

            })

          ) {

            const existingHours = hoursResult.ok ? hoursResult.hours ?? [] : [];

            const suggestedRows = suggestServiceHoursFromTemplates({

              templates,

              planningMode,

              existingServiceHours: existingHours,

            });

            setModeSwitchDialog({

              suggestedRows,

              hasExistingServiceHours: hasConfiguredServiceHours(existingHours),

              previousMode,

              newMode: planningMode,

            });

            return;

          }

        }

      }



      await persistArea();

    });

  }



  function handleModeSwitchApply() {

    if (!modeSwitchDialog) return;

    startTransition(async () => {

      const ok = await persistArea(modeSwitchDialog.suggestedRows);

      if (ok) setModeSwitchDialog(null);

    });

  }



  function handleModeSwitchManual() {

    setModeSwitchDialog(null);

    startTransition(async () => {

      await persistArea();

    });

  }



  return (

    <div

      className={settingsNestedModalOverlayClass()}

      role="presentation"

      onMouseDown={(e) => {

        if (e.target === e.currentTarget && !pending) onClose();

      }}

    >

      <div

        role="dialog"

        aria-modal="true"

        aria-labelledby="location-area-form-title"

        className={settingsNestedModalDialogClass("lg")}

        onMouseDown={(e) => e.stopPropagation()}

      >

        <div className={cn("flex items-center justify-between border-b border-border", settingsModalHeaderPaddingClass())}>

          <h3

            id="location-area-form-title"

            className={SETTINGS_MODAL_TITLE_CLASS}

          >

            {mode === "create"

              ? t("locations.areaCreateTitle")

              : t("locations.areaEditTitle")}

          </h3>

          <IconButton

            size="sm"

            onClick={onClose}

            disabled={pending}

            aria-label={t("common.close")}

            className="border-transparent bg-transparent hover:bg-subtle"

          >

            <CloseIcon className="h-[18px] w-[18px]" />

          </IconButton>

        </div>



        <div className={cn("space-y-5", settingsModalBodyPaddingClass())}>

          {error && <Alert variant="error">{error}</Alert>}



          <div>

            <LabelMuted>{t("locations.areaName")}</LabelMuted>

            <Input

              value={name}

              onChange={(e) => setName(e.target.value)}

              maxLength={25}

              placeholder={t("locations.areaNamePlaceholder")}

            />

          </div>



          <AreaPlanningModeField

            value={planningMode}

            onChange={setPlanningMode}

            disabled={pending}

          />

        </div>



        <div className={settingsModalFooterClass()}>

          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>

            <CloseIcon />

            {t("common.cancel")}

          </Button>

          <Button type="button" variant="primary" onClick={handleSubmit} disabled={pending}>

            <CheckIcon />

            {t("common.ok")}

          </Button>

        </div>

      </div>



      {modeSwitchDialog && (

        <AreaPlanningModeServiceHoursDialog

          previousMode={modeSwitchDialog.previousMode}

          newMode={modeSwitchDialog.newMode}

          suggestedRows={modeSwitchDialog.suggestedRows}

          hasExistingServiceHours={modeSwitchDialog.hasExistingServiceHours}

          pending={pending}

          onCancel={() => setModeSwitchDialog(null)}

          onApply={handleModeSwitchApply}

          onManual={handleModeSwitchManual}

        />

      )}

    </div>

  );

}

