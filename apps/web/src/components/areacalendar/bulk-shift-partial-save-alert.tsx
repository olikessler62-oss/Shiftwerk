"use client";

import { MODAL_SCROLLBAR_CLASS } from "@/components/settings/settings-list-ui";
import {
  bulkShiftPartialSaveListShouldScroll,
  type BulkShiftPartialSaveFailure,
} from "@/lib/bulk-shift-partial-save";
import { cn } from "@/lib/cn";

/** Sichtbare Höhe für ca. vier Einträge (text-sm, Name + Fehlertext). */
const PARTIAL_SAVE_LIST_MAX_HEIGHT_CLASS = "max-h-[18rem]";

type Props = {
  failures: readonly BulkShiftPartialSaveFailure[];
  intro: string;
  messageId: string;
  translateEntry: (failure: BulkShiftPartialSaveFailure) => string;
};

export function BulkShiftPartialSaveAlertContent({
  failures,
  intro,
  messageId,
  translateEntry,
}: Props) {
  const scrollEntries = bulkShiftPartialSaveListShouldScroll(failures.length);

  return (
    <>
      <p id={messageId} className="shrink-0 text-sm font-medium text-foreground">
        {intro}
      </p>
      <ul
        className={cn(
          "mt-3 list-none space-y-3 text-sm text-foreground",
          scrollEntries &&
            cn(
              "min-h-0 overflow-y-auto pr-1",
              MODAL_SCROLLBAR_CLASS,
              PARTIAL_SAVE_LIST_MAX_HEIGHT_CLASS
            )
        )}
      >
        {failures.map((failure, index) => (
          <li
            key={`${failure.name}-${failure.startTime}-${index}`}
            className="whitespace-pre-line"
          >
            {translateEntry(failure)}
          </li>
        ))}
      </ul>
    </>
  );
}
