export { Schema, SCHEMA_SQL_PATH } from "./schema";
export type {
  SchichtwerkDatabase,
  ShiftTypeBreakInput,
  ShiftWithTypeRow,
  DashboardShiftRow,
  AvailabilityRow,
} from "./interface";
export {
  createDatabase,
  SupabaseSchichtwerkDatabase,
} from "./supabase-database";
export {
  validateShiftTypeUniqueness,
  type ShiftTypeUniquenessInput,
} from "./shift-type-validation";
export {
  validateQualificationUniqueness,
  validateQualificationArchive,
  type QualificationUniquenessInput,
} from "./qualification-validation";
export {
  validateRoleUniqueness,
  validateRoleArchive,
  slugifyRoleKey,
  isValidPermissionLevel,
  type RoleUniquenessInput,
} from "./role-validation";
export {
  validateLocationUniqueness,
  validateLocationInput,
  type LocationUniquenessInput,
  type LocationInput,
} from "./location-validation";
export {
  ACTIVE_WEEKDAYS_LENGTH,
  activeWeekdaysToBooleans,
  booleansToActiveWeekdays,
  formatActiveWeekdaysLabel,
  formatLocationOpenDaysLabel,
  isValidActiveWeekdays,
  validateActiveWeekdaysField,
  type WeekdayAbbrevLocale,
} from "./location-weekdays";
export {
  validateLocationAreaUniqueness,
  validateLocationAreaName,
  type LocationAreaUniquenessInput,
} from "./location-area-validation";
export {
  PROFILE_COLOR_PALETTE,
  getProfileColorLabel,
  isProfilePaletteColor,
  validateProfileColorAssignment,
  type ProfileColorOption,
} from "./profile-colors";
export {
  validateProfileEmail,
  validateProfileMobilePhone,
} from "./profile-contact-validation";
export {
  dayBefore,
  isMutableHourlyRate,
  parseHourlyRateAmount,
  parseValidFromDate,
  validateMutableHourlyRateValidFrom,
  validateNewHourlyRate,
} from "./profile-hourly-rate-validation";
export {
  isOvernightAvailability,
  parseAvailabilityTimeRange,
  parseAvailabilityWeekday,
  PROFILE_AVAILABILITY_EQUAL_TIMES_ERROR,
  timeRangesOverlap,
  timeToMinutes,
  toProfileAvailabilitySaveError,
  validateNoOverlappingAvailability,
} from "./profile-availability-validation";
export {
  requiredStaffForAreaOnDate,
  weekdayIndexFromDate,
  STAFFING_HOLIDAY_WEEKDAY,
  type StaffingRule,
} from "./location-staffing";
export {
  isAreaOpenOnWeekday,
  isStaffingDayEnabled,
  isServiceHoursTableUnavailable,
  SERVICE_HOLIDAY_WEEKDAY,
  SERVICE_HOURS_MIGRATION_HINT,
  type AreaServiceHourRef,
} from "./location-service-hours";
export {
  validateServiceHoursInput,
  type ServiceHourInput,
} from "./location-service-hours-validation";
export {
  validateStaffingRulesInput,
  type StaffingRuleInput,
} from "./location-staffing-validation";
export {
  MAX_SHIFT_TYPES_PER_ORGANIZATION,
  centeredBreakForShift,
  getBreakDurationRule,
  getSuggestedBreakMinutes,
  breakRuleHint,
  validateShiftTypeBreaks,
  validateShiftTypeCount,
} from "./shift-type-break-rules";
