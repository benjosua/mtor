import { Group, co, z } from "jazz-tools";

export const WeightUnit = z.enum(["kg", "lbs"]);

export const WorkoutSet = co.map({
  order: z.number(),
  status: z.enum(["todo", "completed", "skipped"]),
  reps: z.optional(z.number()),
  weight: z.optional(z.number()),
  duration: z.optional(z.number()),
  distance: z.optional(z.number()),
  rir: z.optional(z.number()),
  side: z.optional(z.enum(["left", "right"])),
});

export const Exercise = co.map({
  order: z.number(),
  type: z.string(),
  templateId: z.string(),
  name: z.optional(z.string()),
  restBetweenSets: z.optional(z.number()),
  weightUnit: z.optional(WeightUnit),
  trackingOverrides: co.optional(
    co.map({
      rir: z.optional(z.boolean()),
      "1rm": z.optional(z.boolean()),
      "10rm": z.optional(z.boolean()),
      last1rm: z.optional(z.boolean()),
      last10rm: z.optional(z.boolean()),
    })
  ),
  sets: co.list(WorkoutSet),
});

export const PlanExercise = co.map({
  order: z.number(),
  templateId: z.string(),
  name: z.optional(z.string()),
  type: z.string(),
  targetSets: z.optional(z.number()),
  targetReps: z.optional(z.number()),
  restBetweenSets: z.optional(z.number()),
  weightUnit: z.optional(WeightUnit),
  sideType: z.optional(z.enum(["bilateral", "unilateral_left", "unilateral_right", "unilateral_alternating"])),
});

export const PlanDay = co.map({
  name: z.string(),
  order: z.number(),
  exercises: co.list(PlanExercise),
});

export const Plan = co.map({
  name: z.string(),
  isActive: z.boolean(),
  days: co.list(PlanDay),
});

export const Session = co.map({
  planId: z.optional(z.string()),
  dayId: z.optional(z.string()),
  name: z.string(),
  startTime: z.date(),
  endTime: z.optional(z.date()),
  completedAt: z.optional(z.date()),
  exercises: co.list(Exercise),
});

export const ProgressionSettings = co.map({
  repRangeMin: z.number(),
  repRangeMax: z.number(),
  rir: z.optional(z.number()),
});

export const Settings = co.map({
  availableEquipment: co.list(z.string()),
  weightUnit: z.optional(WeightUnit),
  trackingSettings: co.map({
    rir: z.boolean(),
    "1rm": z.boolean(),
    "10rm": z.boolean(),
    last1rm: z.boolean(),
    last10rm: z.boolean(),
    showExerciseType: z.optional(z.boolean()),
    showExerciseDetails: z.optional(z.boolean()),
    showHistoryBadges: z.optional(z.boolean()),
    showHistoryCard: z.optional(z.boolean()),
    displayDetailedMuscles: z.optional(z.boolean()),
  }),
  defaultPlanSettings: co.optional(
    co.map({
      sets: z.number(),
      reps: z.number(),
      rir: z.optional(z.number()),
    })
  ),
  globalRestTimer: z.optional(z.number()),
  warmupSuggestions: z.optional(z.boolean()),
  progressionEnabled: z.boolean(),
  defaultProgressionSettings: ProgressionSettings,
  progressionOverrides: co.record(z.string(), ProgressionSettings),
});

export const CustomExercise = co.map({
  name: z.string(),
  bodyPart: z.string(),
  equipment: z.string(),
  primaryMuscleKeys: co.list(z.string()),
  secondaryMuscleKeys: co.list(z.string()),
  compound: z.boolean(),
  unilateral: z.optional(z.boolean()),
  instructions: co.list(z.string()),
  notes: z.optional(z.string()),
});

export const RestTimerState = co.map({
  key: z.number(),
  initialDuration: z.number(),
  endTime: z.date(),
  isPaused: z.boolean(),
  pauseTime: z.optional(z.date()),
});

export const AccountRoot = co.map({
  plans: co.list(Plan),
  sessions: co.list(Session),
  settings: Settings,
  customExercises: co.record(z.string(), CustomExercise),
  exerciseNotes: co.record(z.string(), z.string()),
  restTimer: co.optional(RestTimerState),
});

export const UserProfile = co.profile({
  name: z.string(),
});

export const WorkoutAppAccount = co
  .account({
    root: AccountRoot,
    profile: UserProfile,
  })
  .withMigration(async (account, creationProps?: { name: string }) => {
    
    const { masterLibrary } = await import('@/data/master-library');

    if (account.root === undefined) {
      console.log("Migration: New account setup.");
      const initialEquipment = [
        'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight',
        'band', 'ezBarbell', 'smithMachine', 'trapBar', 'weighted', 'sledMachine'
      ];
      const settings = Settings.create({
        availableEquipment: initialEquipment,
        weightUnit: "kg",
        trackingSettings: {
          rir: false,
          "1rm": false,
          "10rm": false,
          last1rm: false,
          last10rm: false,
          showExerciseDetails: false,
          showExerciseType: false,
          showHistoryBadges: true,
          showHistoryCard: false,
          displayDetailedMuscles: false,
        },
        defaultPlanSettings: { sets: 3, reps: 10, rir: 2 },
        globalRestTimer: 90,
        warmupSuggestions: false,
        progressionEnabled: false,
        defaultProgressionSettings: { repRangeMin: 5, repRangeMax: 8, rir: 2 },
        progressionOverrides: co
          .record(z.string(), ProgressionSettings)
          .create({}),
      });

      account.$jazz.set(
        "root",
        AccountRoot.create({
          plans: co.list(Plan).create([]),
          sessions: co.list(Session).create([]),
          settings: settings,
          customExercises: co.record(z.string(), CustomExercise).create({}),
          exerciseNotes: co.record(z.string(), z.string()).create({}),
        })
      );
    }

    const { root: loadedRoot } = await account.$jazz.ensureLoaded({
      resolve: {
        root: {
          settings: {
            availableEquipment: true,
          },
          plans: { $each: { days: { $each: { exercises: { $each: true } } } } },
          sessions: { $each: { exercises: { $each: true } } },
          customExercises: true,
          
        },
      },
    });

    
    if ((loadedRoot as any).lastPerformances) {
      (loadedRoot as any).$jazz.delete("lastPerformances");
      console.log("Migration: Removed obsolete `lastPerformances` cache.");
    }

    
    if (!loadedRoot.exerciseNotes) {
      loadedRoot.$jazz.set(
        "exerciseNotes",
        co.record(z.string(), z.string()).create({})
      );
      console.log("Migration: Added `exerciseNotes` record.");
    }

    const trackingSettings = loadedRoot.settings?.trackingSettings as any;

    if (loadedRoot.settings) {
      const equipmentList = loadedRoot.settings.availableEquipment;
      if (equipmentList && !equipmentList.includes("machine")) {
        console.log("Migration: Adding 'machine' to available equipment.");
        equipmentList.$jazz.push("machine");
      }
      if (loadedRoot.settings.defaultPlanSettings === undefined) {
        console.log("Migration: `defaultPlanSettings` missing. Creating...");
        loadedRoot.settings.$jazz.set(
          "defaultPlanSettings",
          co
            .map({
              sets: z.number(),
              reps: z.number(),
              rir: z.optional(z.number()),
            })
            .create({ sets: 3, reps: 10, rir: 2 })
        );
      }
      if (loadedRoot.settings.globalRestTimer === undefined) {
        loadedRoot.settings.$jazz.set("globalRestTimer", 90);
      }
      if (loadedRoot.settings.warmupSuggestions === undefined) {
        loadedRoot.settings.$jazz.set("warmupSuggestions", true);
      }
      if (loadedRoot.settings.weightUnit === undefined) {
        loadedRoot.settings.$jazz.set("weightUnit", "kg");
      }
      if (loadedRoot.settings.progressionEnabled === undefined) {
        loadedRoot.settings.$jazz.set("progressionEnabled", false);
      }
      if (loadedRoot.settings.defaultProgressionSettings === undefined) {
        loadedRoot.settings.$jazz.set(
          "defaultProgressionSettings",
          ProgressionSettings.create({ repRangeMin: 5, repRangeMax: 8, rir: 2 })
        );
      }
      if (loadedRoot.settings.progressionOverrides === undefined) {
        loadedRoot.settings.$jazz.set(
          "progressionOverrides",
          co.record(z.string(), ProgressionSettings).create({})
        );
      }
      if (
        trackingSettings &&
        trackingSettings.showExerciseDetails === undefined
      ) {
        trackingSettings.$jazz.set("showExerciseDetails", false);
      }
      if (trackingSettings && trackingSettings.showExerciseType === undefined) {
        trackingSettings.$jazz.set("showExerciseType", false);
      }
      if (
        trackingSettings &&
        trackingSettings.showHistoryBadges === undefined
      ) {
        trackingSettings.$jazz.set("showHistoryBadges", true);
      }
      if (trackingSettings && trackingSettings.showHistoryCard === undefined) {
        trackingSettings.$jazz.set("showHistoryCard", false);
      }
      if (trackingSettings && trackingSettings.displayDetailedMuscles === undefined) {
        trackingSettings.$jazz.set("displayDetailedMuscles", false);
      }
    }

    if (account.profile === undefined) {
      const profileGroup = Group.create();
      profileGroup.makePublic("reader");
      account.$jazz.set(
        "profile",
        UserProfile.create(
          { name: creationProps?.name || "Anonymous User" },
          profileGroup
        )
      );
    }

    const processExercise = (ex: any) => {
      const nameToIdMap = new Map(
        Object.entries(masterLibrary).map(([id, data]) => [
          data.name.en.toLowerCase(),
          id,
        ])
      );
      if (ex.templateId) return;
      if (ex.name) {
        const foundId = nameToIdMap.get(ex.name.toLowerCase());
        if (foundId) {
          ex.$jazz.set("templateId", foundId);
          
          if (ex.name === masterLibrary[foundId].name.en) {
            ex.$jazz.delete("name");
          }
        }
      }
    };

    loadedRoot.plans?.forEach((p: any) =>
      p?.days?.forEach((d: any) =>
        d?.exercises?.forEach((ex: any) => ex && processExercise(ex))
      )
    );
    loadedRoot.sessions?.forEach((s: any) =>
      s?.exercises?.forEach((ex: any) => ex && processExercise(ex))
    );

    
    
    

    
    const customExercises = loadedRoot.customExercises;
    if (customExercises) {
      for (const exId in customExercises) {
        if (Object.prototype.hasOwnProperty.call(customExercises, exId)) {
          const ex = customExercises[exId] as any;
          if (!ex) continue;

          
          if (ex.target && !ex.primaryMuscleKeys) {
            const primaryList = co.list(z.string()).create([ex.target]);
            ex.$jazz.set("primaryMuscleKeys", primaryList);
            ex.$jazz.delete("target");
            console.log("Migration: Migrated custom exercise target to primaryMuscleKeys");
          }

          if (ex.secondaryMuscles && !ex.secondaryMuscleKeys) {
            const secondaryList = co.list(z.string()).create([...ex.secondaryMuscles]);
            ex.$jazz.set("secondaryMuscleKeys", secondaryList);
            ex.$jazz.delete("secondaryMuscles");
            console.log("Migration: Migrated custom exercise secondaryMuscles to secondaryMuscleKeys");
          }

          
          if (ex.compound === undefined) {
            ex.$jazz.set("compound", false);
          }
        }
      }
    }
  });
