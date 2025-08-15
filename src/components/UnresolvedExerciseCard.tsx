import { ExerciseSearch } from '@/components/ExerciseSearch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    type PlanExerciseResolved,
    type PlanWithRelations
} from '@/jazz/db';
import { AlertTriangle, LinkIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function UnresolvedExerciseCard({
    exercise,
    plan,
}: {
    exercise: PlanExerciseResolved;
    plan: PlanWithRelations;
}) {
    const { t } = useTranslation();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [applyToAll, setApplyToAll] = useState(true);
    const [resolvingExercise, setResolvingExercise] = useState<PlanExerciseResolved | null>(null);

    const exerciseAsAny = exercise as any;

    const similarOrphanCount = useMemo(() => {
        return plan.days
            .flatMap((day) => day.exercises)
            .filter(
                (ex) =>
                    !!ex && !ex.templateId && ex.name === exerciseAsAny.name
            ).length;
    }, [plan.days, exerciseAsAny.name]);

    const updateExerciseAndCleanup = useCallback((ex: PlanExerciseResolved) => {
        const exerciseToUpdate = ex as any;

        if ('name' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('name');
        if ('bodyPart' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('bodyPart');
        if ('equipment' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('equipment');
        if ('target' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('target');
        if ('secondaryMuscles' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('secondaryMuscles');
        if ('instructions' in exerciseToUpdate) exerciseToUpdate.$jazz.delete('instructions');
    }, []);

    const handleResolve = useCallback(async (templateId: string) => {
        const orphanNameToResolve = (resolvingExercise as any)?.name;
        if (!orphanNameToResolve) return;

        if (applyToAll) {
            plan.days.forEach(day => {
                day.exercises.forEach(ex => {
                    if (ex && !ex.templateId && ex.name === orphanNameToResolve) {
                        ex.$jazz.set('templateId', templateId);
                        updateExerciseAndCleanup(ex);
                    }
                });
            });
        } else if (resolvingExercise) {
            resolvingExercise.$jazz.set('templateId', templateId);
            updateExerciseAndCleanup(resolvingExercise);
        }

        setIsSheetOpen(false);
    }, [plan, resolvingExercise, applyToAll, updateExerciseAndCleanup]);

    const openSheet = () => {
        setResolvingExercise(exercise);
        setIsSheetOpen(true);
    };

    const closeSheet = () => {
        setIsSheetOpen(false);
        setResolvingExercise(null);
    };

    return (
        <>
            <Card className="border-l-4 border-amber-500 bg-amber-50/50">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                        <div>
                            <p className="font-semibold">{exerciseAsAny.name}</p>
                            <p className="text-sm text-muted-foreground">
                                {t('unresolved.description')}
                            </p>
                        </div>
                    </div>
                    <Button onClick={openSheet}>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        {t('unresolved.resolveButton')}
                    </Button>
                </CardContent>
            </Card>

            <Sheet open={isSheetOpen} onOpenChange={closeSheet}>
                <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
                    <SheetHeader className="p-6 pb-4">
                        <SheetTitle>{t('unresolved.sheetTitle')}</SheetTitle>
                    </SheetHeader>
                    {similarOrphanCount > 1 && (
                        <div className="px-6 pb-4 border-b flex items-center space-x-2">
                            <Checkbox
                                id="apply-to-all"
                                checked={applyToAll}
                                onCheckedChange={(checked) => setApplyToAll(Boolean(checked))}
                            />
                            <Label htmlFor="apply-to-all" className="text-sm">
                                {t('unresolved.applyToAll', { count: similarOrphanCount, name: exerciseAsAny.name })}
                            </Label>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto">
                        {isSheetOpen && resolvingExercise && (
                            <ExerciseSearch
                                isOpen={true}
                                onClose={closeSheet}
                                onSelectExercise={handleResolve}
                                exerciseToSwap={resolvingExercise as PlanExerciseResolved}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}