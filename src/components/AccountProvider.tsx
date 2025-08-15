import { WorkoutAppAccount } from "@/jazz/schema";
import { createAccountSubscriptionContext } from "jazz-tools/react";

export const { Provider: AccountProvider, useSelector: useAccountSelector } =
  createAccountSubscriptionContext(WorkoutAppAccount, {
    profile: true,
    root: {
      settings: {
        availableEquipment: true,
        trackingSettings: true,
        defaultPlanSettings: true,
        defaultProgressionSettings: true,
        progressionOverrides: true,
      },
      customExercises: { $each: true },
      exerciseNotes: true,
      plans: { $each: { days: { $each: { exercises: { $each: true } } } } },
      sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } },
      restTimer: true,
    },
  });
