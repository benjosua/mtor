import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExerciseWithRelations } from "@/jazz/db";
import { useSettings } from "@/jazz/db";
import { calculateEpley1RM, getWeightForReps } from "@/lib/analysis";
import { convertKgToDisplay } from "@/lib/utils";
import { X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ExerciseType, type TSet as LocalTSet } from "../lib/types";

export function ExerciseHistoryCard({ exercise, lastPerformance }: {
    exercise: ExerciseWithRelations;
    lastPerformance: ExerciseWithRelations | null;
}) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const displayUnit = useMemo(() => exercise.weightUnit ?? settings?.weightUnit ?? 'kg', [exercise.weightUnit, settings?.weightUnit]);
    const isRirEnabled = exercise.trackingOverrides?.rir ?? settings?.trackingSettings?.rir ?? false;
    const is1rmEnabled = exercise.trackingOverrides?.['1rm'] ?? settings?.trackingSettings?.['1rm'] ?? false;
    const is10rmEnabled = exercise.trackingOverrides?.['10rm'] ?? settings?.trackingSettings?.['10rm'] ?? false;

    if (!lastPerformance?.sets || lastPerformance.sets.length === 0) {
        return null;
    }

    return (
        <Card className="mt-4">
            <div className="px-4 py-3">
                <div className="mb-3">
                    <span className="text-sm font-medium text-muted-foreground">{t('exercise.lastPerformedSets')}</span>
                </div>
                <div className="space-y-2">
                    {lastPerformance.sets.map((setData, index) => {
                        if (!setData) return null;
                        
                        const localSetData: LocalTSet = {
                            id: setData.$jazz.id,
                            order: setData.order,
                            status: setData.status,
                            reps: setData.reps,
                            weight: setData.weight,
                            duration: setData.duration,
                            distance: setData.distance,
                            rir: setData.rir,
                            side: setData.side,
                        };

                        const isCompleted = localSetData.status === 'completed';
                        const lastWeightDisplay = convertKgToDisplay(localSetData.weight, displayUnit);
                        const sideDisplay = localSetData.side ? ` (${localSetData.side.charAt(0).toUpperCase()})` : '';
                        
                        
                        let estimations: { e1rm: string | null; e10rm: string | null } = { e1rm: null, e10rm: null };
                        if (exercise.type === ExerciseType.Sets && typeof localSetData.weight === "number" && typeof localSetData.reps === "number") {
                            const e1rm = calculateEpley1RM(localSetData.weight, localSetData.reps, localSetData.rir ?? 0);
                            if (e1rm > 0) {
                                const e10rm = getWeightForReps(e1rm, 10);
                                estimations = { e1rm: e1rm.toFixed(1), e10rm: e10rm.toFixed(1) };
                            }
                        }

                        return (
                            <div key={index} className="flex w-full items-center justify-between gap-2 rounded-lg">
                                <div className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {index + 1}
                                </div>
                                <div className={`flex flex-col grow items-center justify-center gap-1.5 transition-all ${isCompleted ? "grayscale opacity-75 brightness-90" : ""}`}>
                                    {isCompleted ? (
                                        <div className="h-auto justify-center gap-2 px-3 py-1.5 font-normal border border-dashed rounded-lg flex items-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-semibold leading-tight">{lastWeightDisplay || "-"}</span>
                                                <span className="text-xs text-muted-foreground">{displayUnit}</span>
                                            </div>
                                            <X size={16} className="shrink-0 text-muted-foreground" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-semibold leading-tight">{localSetData.reps ?? "-"}{sideDisplay}</span>
                                                <span className="text-xs text-muted-foreground">{t('common.reps')}</span>
                                            </div>
                                            {isRirEnabled && localSetData.rir != null && (
                                                <>
                                                    <div className="mx-1 h-6 w-px bg-border" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-lg font-semibold leading-tight">{localSetData.rir}</span>
                                                        <span className="text-xs text-muted-foreground">{t('common.rir')}</span>
                                                    </div>
                                                </>
                                            )}
                                            {is1rmEnabled && estimations.e1rm && (
                                                <>
                                                    <div className="mx-1 h-6 w-px bg-border" />
                                                    <div className="flex flex-col items-center cursor-default">
                                                        <span className="text-lg font-semibold leading-tight">{convertKgToDisplay(parseFloat(estimations.e1rm), displayUnit).toFixed(1)}</span>
                                                        <span className="text-xs text-muted-foreground">{t('common.e1rm')}</span>
                                                    </div>
                                                </>
                                            )}
                                            {is10rmEnabled && estimations.e10rm && (
                                                <>
                                                    <div className="mx-1 h-6 w-px bg-border" />
                                                    <div className="flex flex-col items-center cursor-default">
                                                        <span className="text-lg font-semibold leading-tight">{convertKgToDisplay(parseFloat(estimations.e10rm), displayUnit).toFixed(1)}</span>
                                                        <span className="text-xs text-muted-foreground">{t('common.e10rm')}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-x-1.5 rounded-md bg-transparent px-3 py-1.5 font-mono text-xs text-muted-foreground border border-dashed">
                                            <span>{t('exercise.skipped')}</span>
                                        </div>
                                    )}
                                </div>
                                <Checkbox checked={isCompleted} className="size-6 pointer-events-none" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}