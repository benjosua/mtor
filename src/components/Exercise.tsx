import { useDialog } from "@/components/DialogProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { masterLibrary } from "@/data/master-library";
import { useExerciseAnalysis } from "@/hooks/useExerciseAnalysis";
import { useExerciseNote } from "@/hooks/useExerciseNote";
import { usePrimaryMuscleKeys } from "@/hooks/usePrimaryMuscleKeys";
import { useResolvedExerciseDetails } from "@/hooks/useResolvedExercise";
import type { ExerciseWithRelations, SessionWithRelations } from "@/jazz/db";
import { addSetToSession, deleteExerciseFromSession, deleteLastSetFromSession, updateExercise, updateWeightUnitForExerciseHistory, useCustomExercises, useSettings } from "@/jazz/db";
import { stretchMediatedHypertrophyMuscles } from "@/lib/muscleUtils";
import { cn } from "@/lib/utils";
import { co, z } from "jazz-tools";
import { Activity, AlertCircle, BookMarked, CheckCircle, Ellipsis, ListPlus, Pin, Replace, SquarePen, Timer, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import type { TTrackingOverrides } from "../lib/types";
import { ExerciseHistoryCard } from "./ExerciseHistoryCard";
import { SetList } from "./SetList";
import { Badge } from "./ui/badge";

const roundToNearest = (value: number, increment: number): number => {
    return Math.round(value / increment) * increment;
};

const IconWithText = ({ letter, text, hint }: { letter: string; text: string | null | undefined; hint: string }) => {
    if (!text) return null;
    return (
        <Tooltip><TooltipTrigger asChild><div className="mb-2 mr-4 flex cursor-default items-center capitalize"><div className="mr-2 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-card">{letter}</div><span className="text-primary">{text}</span></div></TooltipTrigger><TooltipContent><p>{hint}</p></TooltipContent></Tooltip>
    )
};

const SmhHint = ({ className }: { className?: string }) => {
    const { t } = useTranslation();
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={cn("ml-2 text-xs cursor-pointer", className)}>SMH</Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t('exercise.smhHint')}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const WarmUpHint = ({
    exercise,
    session,
    lastPerformance
}: {
    exercise: ExerciseWithRelations;
    session: SessionWithRelations;
    lastPerformance: ExerciseWithRelations | null;
}) => {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const { customExercises } = useCustomExercises();
    const resolvedDetails = useResolvedExerciseDetails(exercise);

    const warmupInfo = useMemo(() => {
        if (!settings?.warmupSuggestions) {
            return null;
        }

        const exerciseIndex = session.exercises.findIndex((ex) => ex?.$jazz.id === exercise.$jazz.id);
        if (exerciseIndex === -1) return null;
        const previousExercises = session.exercises.slice(0, exerciseIndex).filter((ex): ex is ExerciseWithRelations => !!ex);

        const warmedUpPrimary = new Set<string>();
        const warmedUpSecondary = new Set<string>();

        previousExercises.forEach((ex) => {
            if (!ex.templateId) return;

            const libDetails = masterLibrary[ex.templateId];
            const customDetails = customExercises?.find(c => c.$jazz.id === ex.templateId);

            let primary: readonly string[] = [];
            let secondary: readonly string[] = [];

            if (libDetails) {
                primary = libDetails.primaryMuscleKeys || [];
                secondary = libDetails.secondaryMuscleKeys || [];
            } else if (customDetails) {
                primary = customDetails.primaryMuscleKeys || [];
                secondary = customDetails.secondaryMuscleKeys || [];
            }

            if (primary && primary.length > 0) warmedUpPrimary.add(primary[0].toLowerCase());
            if (secondary) {
                secondary.forEach((muscle: string) => muscle && warmedUpSecondary.add(muscle.toLowerCase()));
            }
        });

        const currentTargetMuscles = resolvedDetails?.primaryMuscles || [];
        if (currentTargetMuscles.length === 0) return null;

        const mainTarget = currentTargetMuscles[0];
        const lowerCaseTarget = mainTarget.toLowerCase();
        const isWarmedAsPrimary = warmedUpPrimary.has(lowerCaseTarget);
        const isWarmedAsSecondary = warmedUpSecondary.has(lowerCaseTarget);

        if (isWarmedAsPrimary) {
            return { type: 'warmed', muscle: mainTarget };
        } else if (!isWarmedAsPrimary && !isWarmedAsSecondary) {
            return { type: 'full' };
        } else if (!isWarmedAsPrimary && isWarmedAsSecondary) {
            return { type: 'partial', muscle: mainTarget };
        }
        return null;

    }, [session.exercises, exercise.$jazz.id, resolvedDetails, settings?.warmupSuggestions, customExercises]);

    if (!warmupInfo) return null;

    if (warmupInfo.type === 'full') {
        let weightSuggestion = t('exercise.lightWeight');
        const firstSetWeight = lastPerformance?.sets?.find(s => s?.status === 'completed')?.weight;

        if (firstSetWeight && firstSetWeight > 0) {
            const low = roundToNearest(firstSetWeight * 0.3, 1.25);
            const high = roundToNearest(firstSetWeight * 0.4, 1.25);
            weightSuggestion = low > 0 ? `${low.toFixed(2)}-${high.toFixed(2)}kg` : `${high.toFixed(2)}kg`;
        }
        return (
            <Badge variant={"outline"} className="flex-wrap mt-2">
                <Activity className="h-3 w-3" />
                <span>
                    {t('exercise.warmUp')} <strong>{t('exercise.warmUpSets', { sets: 1, reps: '5-8' })}</strong> with {weightSuggestion}
                </span>
            </Badge>
        );
    }

    if (warmupInfo.type === 'warmed') {
        return (
            <Badge variant={"outline"} className="flex-wrap mt-2">
                <CheckCircle className="h-3 w-3" />
                <span>
                    {t('exercise.muscleWarm', { muscle: warmupInfo.muscle })}
                </span>
            </Badge>
        );
    }

    if (warmupInfo.type === 'partial') {
        return (
            <Badge variant={"outline"} className="flex-wrap mt-2">
                <AlertCircle className="h-3 w-3" />
                <span>
                    {t('exercise.musclePartiallyWarm', { muscle: warmupInfo.muscle })}
                </span>
            </Badge>
        );
    }
    return null;
};

export function Exercise({ exercise, session, onInitiateSwap }: { exercise: ExerciseWithRelations; session: SessionWithRelations; onInitiateSwap: (exercise: ExerciseWithRelations) => void; }) {
    const { confirm, prompt } = useDialog();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { t } = useTranslation();

    const { note, setNote } = useExerciseNote(exercise.templateId);

    const resolvedDetails = useResolvedExerciseDetails(exercise);
    const { lastPerformance, progression, lastPerformanceBests } = useExerciseAnalysis(exercise, session);
    const primaryMuscleKeys = usePrimaryMuscleKeys(exercise.templateId);

    const hasSmhMuscle = useMemo(() =>
        primaryMuscleKeys.some(key => stretchMediatedHypertrophyMuscles.has(key as string)),
        [primaryMuscleKeys]
    );

    const globalUnit = settings?.weightUnit ?? 'kg';
    const currentUnit = exercise.weightUnit ?? 'default';

    const handleUpdate = (updates: Partial<ExerciseWithRelations>) => {
        updateExercise(exercise, updates);
    };

    const handleEditNote = () => {
        prompt({
            title: t('exercise.editNote'),
            description: t('exercise.globalNoteDescription'),
            defaultValue: note ?? '',
            onConfirm: (newValue) => {
                setNote(newValue);
            },
        });
    };

    const handlePromptForUpdate = (field: keyof ExerciseWithRelations, title: string, description?: string, inputType?: string) => {
        prompt({
            title, description, inputType,
            defaultValue: `${(exercise as any)[field] ?? ''}`,
            onConfirm: (newValue) => {
                const parsedValue = inputType === 'number' ? (parseInt(newValue, 10) || undefined) : (newValue || undefined);
                handleUpdate({ [field]: parsedValue ?? undefined } as Partial<ExerciseWithRelations>);
            },
        });
    };

    const handleDelete = () => {
        confirm({
            title: t('exercise.deleteExerciseTitle', { name: resolvedDetails?.name || t('common.exercise') }),
            description: t('exercise.deleteExerciseDescription', { name: resolvedDetails?.name || t('common.exercise') }),
            confirmText: t('common.delete'),
            onConfirm: () => {
                deleteExerciseFromSession(session, exercise.$jazz.id);
            }
        });
    };

    const handleRemoveLastSet = () => {
        if (!exercise.sets || exercise.sets.length === 0) return;
        confirm({
            title: t('exercise.removeLastSetTitle'),
            description: t('exercise.removeLastSetDescription'),
            confirmText: t('common.delete'),
            onConfirm: () => {
                deleteLastSetFromSession(exercise);
            }
        });
    };

    const handleUnitChange = (newUnit: 'kg' | 'lbs' | 'default') => {
        const oldExerciseUnit = exercise.weightUnit;
        const newExerciseUnit = newUnit === 'default' ? undefined : newUnit;

        if (oldExerciseUnit === newExerciseUnit) return;

        handleUpdate({ weightUnit: newExerciseUnit });

        if (exercise.templateId) {
            const finalNewUnit = newUnit === 'default' ? globalUnit : newUnit;
            confirm({
                title: t('exercise.updateUnitHistoryTitle'),
                description: (
                    <>
                        {t('exercise.updateUnitHistoryDescription', { name: resolvedDetails?.name, unit: finalNewUnit.toUpperCase() })}
                    </>
                ),
                confirmText: t('exercise.updateHistory'),
                cancelText: t('exercise.justThisWorkout'),
                onConfirm: () => {
                    updateWeightUnitForExerciseHistory(exercise.templateId!, finalNewUnit);
                }
            });
        }
    };

    const handleTrackingOverride = (metric: 'rir' | '1rm' | '10rm', checked: boolean) => {
        if (!exercise.trackingOverrides) {
            exercise.$jazz.set("trackingOverrides", co.map({
                rir: z.optional(z.boolean()),
                '1rm': z.optional(z.boolean()),
                '10rm': z.optional(z.boolean()),
                last1rm: z.optional(z.boolean()),
                last10rm: z.optional(z.boolean()),
            }).create({}));
        }

        const setOverride = (m: keyof TTrackingOverrides, val: boolean) => {
            const effectiveGlobalSetting = settings?.trackingSettings?.[m] ?? false;
            if (val === effectiveGlobalSetting) {
                delete exercise.trackingOverrides?.[m];
            } else if (exercise.trackingOverrides) {
                exercise.trackingOverrides.$jazz.set(m, val);
            }
        };

        if (metric === '1rm') {
            setOverride('1rm', checked);
            setOverride('last1rm', checked);
        } else if (metric === '10rm') {
            setOverride('10rm', checked);
            setOverride('last10rm', checked);
        } else {
            setOverride(metric, checked);
        }

        if (exercise.trackingOverrides && Object.keys(exercise.trackingOverrides).length === 0) {
            exercise.$jazz.delete("trackingOverrides");
        }
    };

    return (
        <>
            <TooltipProvider delayDuration={200}>
                <Card>
                    <div className="relative w-full px-4">
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <span className="shrink grow text-lg font-semibold flex items-center">{resolvedDetails?.name}{hasSmhMuscle && <SmhHint />}</span>
                                {settings?.trackingSettings?.showExerciseType && (
                                    <span className="mr-2 text-sm capitalize text-muted-foreground">{exercise.type.toLowerCase().replace('_', ' ')}</span>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Ellipsis /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {}
                                        <DropdownMenuItem onClick={handleEditNote}>
                                            <SquarePen className="mr-2 size-4" />
                                            <span>{t('exercise.editNote')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onInitiateSwap(exercise)}>
                                            <Replace className="mr-2 size-4" />
                                            <span>{t('exercise.swapExercise')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={async () => await addSetToSession(exercise)}>
                                            <ListPlus className="mr-2 size-4" />
                                            <span>{t('exercise.addSet')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleRemoveLastSet}><Trash2 className="mr-2 size-4" />{t('exercise.removeLastSet')}</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handlePromptForUpdate('restBetweenSets', t('exercise.restTime'), t('planEditor.setRestTimeDescription'), 'number')}>
                                            <Timer className="mr-2 size-4" />
                                            <span>{t('exercise.restTime')} ({exercise.restBetweenSets ?? settings?.globalRestTimer ?? 90}s)</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (exercise.templateId) navigate(`/exercises/${exercise.templateId}`);
                                            }}
                                        >
                                            <BookMarked className="mr-2 size-4" />
                                            <span>{t('exercise.viewDetailsHistory')}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuRadioGroup value={currentUnit} onValueChange={(v) => handleUnitChange(v as 'kg' | 'lbs' | 'default')}>
                                            <DropdownMenuRadioItem value="default">{t('planEditor.defaultUnit', { unit: globalUnit.toUpperCase() })}</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="kg">{t('common.kilograms')} (kg)</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="lbs">{t('common.pounds')} (lbs)</DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={exercise.trackingOverrides?.rir ?? settings?.trackingSettings?.rir ?? false} onCheckedChange={(c: boolean) => handleTrackingOverride('rir', c)}>{t('exercise.showRirInput')}</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={exercise.trackingOverrides?.['1rm'] ?? settings?.trackingSettings?.['1rm'] ?? false} onCheckedChange={(c: boolean) => handleTrackingOverride('1rm', c)}>{t('exercise.show1rm')}</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={exercise.trackingOverrides?.['10rm'] ?? settings?.trackingSettings?.['10rm'] ?? false} onCheckedChange={(c: boolean) => handleTrackingOverride('10rm', c)}>{t('exercise.show10rm')}</DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleDelete}><Trash2 className="mr-2 size-4" />{t('exercise.deleteExercise')}</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            {note && (<div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md"><Pin className="size-4 mt-0.5 shrink-0 text-primary" /><p className="italic">{note}</p></div>)}
                            <WarmUpHint exercise={exercise} session={session} lastPerformance={lastPerformance} />

                            {settings?.trackingSettings?.showExerciseDetails && (
                                <div className="mt-2 border-t pt-2">
                                    <div className="flex flex-wrap pt-2">
                                        <IconWithText letter="B" text={resolvedDetails?.bodyPart} hint="Body Part" />
                                        <IconWithText letter="E" text={resolvedDetails?.equipment} hint="Equipment" />
                                        <IconWithText letter="T" text={resolvedDetails?.target} hint="Target Muscle" />
                                        {(resolvedDetails?.secondaryMuscles || []).map((muscle) => muscle && (<IconWithText key={muscle} letter="S" text={muscle} hint="Secondary Muscle" />))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4">
                                <SetList exercise={exercise} lastPerformance={lastPerformance} progressionPlan={progression} lastPerformanceBests={lastPerformanceBests} />
                            </div>
                        </div>
                    </div>
                </Card>
                {(settings?.trackingSettings?.showHistoryCard ?? false) && (
                    <ExerciseHistoryCard exercise={exercise} lastPerformance={lastPerformance} />
                )}
            </TooltipProvider>
        </>
    );
}

