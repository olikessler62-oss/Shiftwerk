import {
  buildManagerAbsenceSubmittedNotification,
  buildEmployeeAbsenceReviewNotification,
  resolveConfirmationNotificationChannel,
  type SchichtwerkDatabase,
} from "@schichtwerk/database";
import type { AbsenceType, Profile, RequestStatus } from "@schichtwerk/types";

export async function notifyManagersOfSubmittedAbsence(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    employeeId: string;
    employeeName: string;
    absenceId: string;
    type: AbsenceType;
    startDate: string;
    endDate: string | null;
    isOpenEnded: boolean;
    status: RequestStatus;
  }
): Promise<void> {
  const notification = buildManagerAbsenceSubmittedNotification(input);

  const profiles = await db.listOrganizationProfiles(input.organizationId);
  const managers = profiles.filter(
    (profile) => profile.role === "admin" || profile.role === "manager"
  );

  if (managers.length === 0) return;

  await db.insertManagerNotifications(
    input.organizationId,
    managers.map((manager) => ({
      recipient_profile_id: manager.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
    }))
  );

  await db.insertNotificationOutboxEntries(
    input.organizationId,
    managers.map((manager) => ({
      recipient_profile_id: manager.id,
      channel: "push" as const,
      template_key: "absence.submitted",
      payload: {
        absence_id: input.absenceId,
        employee_id: input.employeeId,
        employee_name: input.employeeName,
        type: input.type,
        start_date: input.startDate,
        end_date: input.endDate,
        is_open_ended: input.isOpenEnded,
        status: input.status,
      },
      simulated: true,
    }))
  );
}

export async function notifyEmployeeOfAbsenceReview(
  db: SchichtwerkDatabase,
  input: {
    organizationId: string;
    employeeProfile: Pick<Profile, "id" | "email_fallback_mode" | "app_registered_at">;
    absenceId: string;
    type: AbsenceType;
    startDate: string;
    endDate: string | null;
    isOpenEnded: boolean;
    approved: boolean;
  }
): Promise<void> {
  const notification = buildEmployeeAbsenceReviewNotification({
    absenceId: input.absenceId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    isOpenEnded: input.isOpenEnded,
    approved: input.approved,
  });

  const channel = resolveConfirmationNotificationChannel(input.employeeProfile);

  await db.insertNotificationOutboxEntries(input.organizationId, [
    {
      recipient_profile_id: input.employeeProfile.id,
      channel,
      template_key: notification.templateKey,
      payload: {
        ...notification.payload,
        title: notification.title,
        body: notification.body,
      },
      simulated: input.employeeProfile.app_registered_at == null,
    },
  ]);
}
