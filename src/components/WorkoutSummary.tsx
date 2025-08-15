import { useAccountSelector } from '@/components/AccountProvider';
import { Badge } from '@/components/ui/badge';
import { masterLibrary } from '@/data/master-library';
import {
    useSettings,
    type SessionWithRelations,
    type SetResolved,
    useCustomExercises,
} from '@/jazz/db';
import { calculateEpley1RM, getWeightForReps } from '@/lib/analysis';
import { convertKgToDisplay } from '@/lib/utils';
import { Clock, Medal, Weight } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SessionMetrics {
    totalVolume: number;
    duration: string;
}

interface AnalyzedSet {
    id: string;
    order: number;
    weight: number;
    reps: number;
    rir?: number | null;
    isNewE1RM_PR: boolean;
    isNewE10RM_PR: boolean;
    isNewVolume_PR: boolean;
}

interface AnalyzedExercise {
    templateId: string;
    name: string;
    completedSets: AnalyzedSet[];
    totalPRs: number;
}

interface WorkoutAnalysis {
    sessionMetrics: SessionMetrics;
    exerciseAnalyses: AnalyzedExercise[];
}

interface WorkoutSummaryProps {
    session: SessionWithRelations;
}

export function WorkoutSummary({ session }: WorkoutSummaryProps) {
    const sessions = useAccountSelector({
        select: (me) => me.root?.sessions
    });
    const { settings } = useSettings();
    const { t, i18n } = useTranslation();
    const { customExercises } = useCustomExercises();
    const [analysis, setAnalysis] = useState<WorkoutAnalysis | null>(null);

    const displayUnit = settings?.weightUnit ?? 'kg';

    const resolveExerciseName = useMemo(() => {
        const customExercisesMap = new Map((customExercises || []).map(ex => [ex.$jazz.id, ex.name]));
        const currentLang = i18n.language as 'en' | 'es' | 'de';

        return (templateId: string, nameOverride?: string | null): string => {
            if (nameOverride) return nameOverride;

            const customName = customExercisesMap.get(templateId);
            if (customName) return customName;

            const libraryEntry = masterLibrary[templateId];
            if (libraryEntry) {
                return libraryEntry.name[currentLang] || libraryEntry.name.en;
            }
            return t('app.templateNotFound');
        };
    }, [t, i18n.language, customExercises]);

    useEffect(() => {
        if (!sessions || !session.completedAt || !resolveExerciseName) return;

        
        const historicalBests = new Map<string, {
            bestE1RM: number;
            bestSetVolume: number;
        }>();

        const historicalSessions = sessions
            .filter((s): s is SessionWithRelations => !!s?.completedAt && new Date(s.completedAt) < new Date(session.completedAt!));

        for (const pastSession of historicalSessions) {
            for (const ex of pastSession?.exercises || []) {
                if (!ex?.templateId) continue;
                const completedSets = (ex.sets || []).filter((s): s is SetResolved =>
                    s?.status === 'completed' && s.weight != null && s.reps != null && s.weight > 0 && s.reps > 0
                );
                if (completedSets.length === 0) continue;

                const currentBests = historicalBests.get(ex.templateId) || {
                    bestE1RM: 0, bestSetVolume: 0,
                };

                for (const set of completedSets) {
                    const e1rm = calculateEpley1RM(set.weight!, set.reps!, set.rir ?? 0);
                    if (e1rm > currentBests.bestE1RM) {
                        currentBests.bestE1RM = e1rm;
                    }
                    const setVolume = set.weight! * set.reps!;
                    if (setVolume > currentBests.bestSetVolume) {
                        currentBests.bestSetVolume = setVolume;
                    }
                }
                historicalBests.set(ex.templateId, currentBests);
            }
        }

        
        let totalSessionVolume = 0;
        const exerciseAnalyses: AnalyzedExercise[] = [];

        for (const ex of session.exercises) {
            if (!ex?.templateId) continue;
            const completedSets = (ex.sets || []).filter((s): s is SetResolved =>
                s?.status === 'completed' && s.weight != null && s.reps != null && s.weight > 0 && s.reps > 0
            );
            if (completedSets.length === 0) continue;

            let sessionBestE1RM = 0;
            let sessionBestSetVolume = 0;
            let sessionBestE1RMSetId: string | null = null;
            let sessionBestSetVolumeSetId: string | null = null;

            for (const set of completedSets) {
                totalSessionVolume += set.weight! * set.reps!;
                const e1rm = calculateEpley1RM(set.weight!, set.reps!, set.rir ?? 0);
                if (e1rm > sessionBestE1RM) {
                    sessionBestE1RM = e1rm;
                    sessionBestE1RMSetId = set.$jazz.id;
                }
                const setVolume = set.weight! * set.reps!;
                if (setVolume > sessionBestSetVolume) {
                    sessionBestSetVolume = setVolume;
                    sessionBestSetVolumeSetId = set.$jazz.id;
                }
            }

            const historicals = historicalBests.get(ex.templateId);
            const historicalBestE1RM = historicals?.bestE1RM ?? 0;
            const historicalBestSetVolume = historicals?.bestSetVolume ?? 0;
            const historicalBestE10RM = getWeightForReps(historicalBestE1RM, 10);
            const sessionBestE10RM = getWeightForReps(sessionBestE1RM, 10);
            const isNewE1RM_PR = sessionBestE1RM > historicalBestE1RM;
            const isNewE10RM_PR = sessionBestE10RM > historicalBestE10RM;
            const isNewVolume_PR = sessionBestSetVolume > historicalBestSetVolume;
            const totalPRs = [isNewE1RM_PR, isNewE10RM_PR, isNewVolume_PR].filter(Boolean).length;

            const analyzedSets: AnalyzedSet[] = completedSets.map(set => ({
                id: set.$jazz.id,
                order: set.order,
                weight: set.weight!,
                reps: set.reps!,
                rir: set.rir,
                isNewE1RM_PR: isNewE1RM_PR && set.$jazz.id === sessionBestE1RMSetId,
                isNewE10RM_PR: isNewE10RM_PR && set.$jazz.id === sessionBestE1RMSetId,
                isNewVolume_PR: isNewVolume_PR && set.$jazz.id === sessionBestSetVolumeSetId,
            }));

            exerciseAnalyses.push({
                templateId: ex.templateId,
                name: resolveExerciseName(ex.templateId, ex.name),
                completedSets: analyzedSets,
                totalPRs,
            });
        }

        const duration = DateTime.fromJSDate(new Date(session.endTime!))
            .diff(DateTime.fromJSDate(new Date(session.startTime)))
            .shiftTo('hours', 'minutes', 'seconds')
            .toHuman({ unitDisplay: 'short', showZeros: false, maximumFractionDigits: 0 });

        setAnalysis({
            sessionMetrics: { totalVolume: totalSessionVolume, duration },
            exerciseAnalyses
        });
    }, [sessions, session, resolveExerciseName]);

    if (!analysis) return null;

    const { sessionMetrics, exerciseAnalyses } = analysis;
    const filteredAnalyses = exerciseAnalyses.filter(ex => ex.completedSets.length > 0);
    if (filteredAnalyses.length === 0) return null;

    return (
        <div className="border rounded-lg bg-card text-card-foreground p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-4 gap-y-2 px-1">
                <h2 className="text-base font-semibold tracking-tight">{t('summary.sessionSummary')}</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs"><Weight className="size-3 mr-1.5" />{convertKgToDisplay(sessionMetrics.totalVolume, displayUnit).toFixed(0)} {displayUnit}</Badge>
                    <Badge variant="outline" className="text-xs"><Clock className="size-3 mr-1.5" />{sessionMetrics.duration}</Badge>
                </div>
            </div>

            <div className="border-t">
                {filteredAnalyses.map((ex) => (
                    <div key={ex.templateId} className="grid grid-cols-1 md:grid-cols-[180px_1fr] border-b last:border-b-0">
                        <div className="p-2 md:border-r">
                            <h3 className="font-semibold text-sm">{ex.name}</h3>
                            {ex.totalPRs > 0 && (
                                <Badge variant="secondary" className="mt-1.5 text-xs">
                                    <Medal className="size-3 mr-1" />
                                    {ex.totalPRs} {ex.totalPRs > 1 ? t('summary.newRecords') : t('summary.newRecord')}
                                </Badge>
                            )}
                        </div>
                        <div className="p-2">
                            <div className="space-y-1.5">
                                {ex.completedSets.map((set) => {
                                    const prs: string[] = [];
                                    if (set.isNewVolume_PR) prs.push(t('summary.volume'));
                                    if (set.isNewE1RM_PR) prs.push(t('common.e1rm'));
                                    if (set.isNewE10RM_PR) prs.push(t('common.e10rm'));

                                    return (
                                        <div key={set.id} className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-x-2 gap-y-1 text-xs">
                                            <span className="font-mono text-muted-foreground whitespace-nowrap">
                                                {t('summary.set', { count: set.order + 1 })} {convertKgToDisplay(set.weight, displayUnit)}{displayUnit} &times; {set.reps}
                                                {set.rir != null ? ` @ ${set.rir}RIR` : ''}
                                            </span>
                                            {prs.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {prs.map(pr => (
                                                        <Badge key={pr} variant="outline" className="text-xs font-medium">
                                                            <Medal className="size-3 mr-1" />{pr} {t('common.pr')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}