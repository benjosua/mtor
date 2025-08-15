import { useAccountSelector } from '@/components/AccountProvider';
import { BodyAnatomy, type BodyPartData, type MuscleSlug } from '@/components/BodyAnatomy';
import { backBodyPartData } from '@/components/backBodyPartDataIndexed';
import { frontBodyPartData } from '@/components/frontBodyPartDataIndexed';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { masterLibrary } from '@/data/master-library';
import type { MasterExercise } from '@/data/types';
import {
  useCustomExercises,
  useSettings,
  type CustomExerciseResolved,
  type SessionWithRelations,
  type SetResolved,
} from '@/jazz/db';
import { calculateEpley1RM, getWeightForReps } from '@/lib/analysis';
import { getDisplayMuscleNames, libraryKeyToAnatomySlug } from '@/lib/muscleUtils';
import type { TExerciseLibraryItem } from '@/lib/types';
import { convertKgToDisplay } from '@/lib/utils';
import { ChartLine, History, Medal } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

const chartConfig = {
  e1rm: { label: "e1RM Model (kg)", color: "hsl(var(--chart-1))" },
  e10rm: { label: "e10RM Model (kg)", color: "hsl(var(--chart-2))" },
  weight: { label: "Weight Lifted (kg)", color: "hsl(var(--chart-3))" },
  reps: { label: "Reps Performed", color: "hsl(var(--chart-3))" },
  rir: { label: "RIR" },
} satisfies ChartConfig;

const FULL_SLUG_MAP: { [key: string]: MuscleSlug } = {
  "outline": "outline", "Hands": "hands", "Feet": "feet", "Ankle": "ankles", "Head": "unknown", "Tibialis Anterior": "tibialis-anterior", "Soleus": "soleus", "Gastrocnemius": "gastrocnemius", "quadricepsVasti": "quadricepsVasti", "rectus-femoris": "rectus-femoris", "Hip Adductors": "adductors", "Sartorius": "sartorius", "Hip Flexors": "hip-flexors", "Hamstrings": "hamstrings", "Gluteus_Maximus": "gluteus-maximus", "Abductors": "abductors", "calves": "calves", "Wrist Flexors": "wrist-flexors", "Wrist Extensors": "wrist-extensors", "Pronators": "pronators", "Brachialis": "brachialis", "Triceps Brachii": "triceps", "Brachioradialis": "brachioradialis", "Biceps Brachii": "biceps", "Obliques": "obliques", "Latissimus Dorsi & Teres Major": "lats", "Rectus Abdominis": "abdominals", "Pectoralis Major": "pectorals", "Scalenes": "neck", "Sternocleidomastoid": "neck",
  "Deltoid Anterior": "deltoid-anterior", "Deltoid Medial/Lateral": "deltoid-lateral", "Deltoid Posterior": "deltoid-posterior",
  "Trapezius Upper": "trapezius-upper", "Trapezius Middle": "trapezius-middle", "Trapezius Lower": "trapezius-lower",
  "Quadriceps": "quadriceps"
};

const ExerciseAnatomyView = ({ libraryEntry }: { libraryEntry: MasterExercise | CustomExerciseResolved | null }) => {
  const [sharedViewBox, setSharedViewBox] = useState<string | null>(null);
  const { t } = useTranslation();

  const { primarySlugs, secondarySlugs } = useMemo(() => {
    if (!libraryEntry) return { primarySlugs: [], secondarySlugs: [] };
    const primary = new Set<MuscleSlug>();
    const secondary = new Set<MuscleSlug>();
    const processKeys = (keys: readonly string[], targetSet: Set<MuscleSlug>) => {
      for (const key of keys) {
        const slugs = libraryKeyToAnatomySlug[key];
        if (slugs) {
          (Array.isArray(slugs) ? slugs : [slugs]).forEach(slug => targetSet.add(slug));
        }
      }
    };
    processKeys(libraryEntry.primaryMuscleKeys || [], primary);
    processKeys(libraryEntry.secondaryMuscleKeys || [], secondary);
    primary.forEach(slug => secondary.delete(slug));
    return { primarySlugs: Array.from(primary), secondarySlugs: Array.from(secondary) };
  }, [libraryEntry]);

  useEffect(() => {
    const allHighlightedSlugs = new Set([...primarySlugs, ...secondarySlugs]);
    if (allHighlightedSlugs.size === 0) {
      setSharedViewBox(null);
      return;
    }

    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.style.cssText = 'position:absolute; visibility:hidden; width:0; height:0;';

    const allBodyParts: BodyPartData[] = [...frontBodyPartData, ...backBodyPartData];

    allBodyParts.forEach(part => {
      const unifiedSlug = FULL_SLUG_MAP[part.slug] || 'unknown';
      if (allHighlightedSlugs.has(unifiedSlug)) {
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', part.pathArray.join(' '));
        tempSvg.appendChild(pathEl);
      }
    });

    document.body.appendChild(tempSvg);
    const overallBBox = tempSvg.getBBox();
    document.body.removeChild(tempSvg);

    if (overallBBox && overallBBox.width > 0 && overallBBox.height > 0) {
      const { x, y, width, height } = overallBBox;
      const paddingX = width * 0.3;
      const paddingY = height * 0.3;
      setSharedViewBox(`${x - paddingX} ${y - paddingY} ${width + 2 * paddingX} ${height + 2 * paddingY}`);
    } else {
      setSharedViewBox(null);
    }
  }, [primarySlugs, secondarySlugs]);

  const { allFrontSlugs, allBackSlugs } = useMemo(() => {
    const getSlugs = (data: BodyPartData[]): Set<MuscleSlug> =>
      new Set(data.map(p => FULL_SLUG_MAP[p.slug]).filter(Boolean) as MuscleSlug[]);
    return { allFrontSlugs: getSlugs(frontBodyPartData), allBackSlugs: getSlugs(backBodyPartData) };
  }, []);

  const allHighlighted = [...primarySlugs, ...secondarySlugs];
  const hasFrontFeature = allHighlighted.some(slug => allFrontSlugs.has(slug));
  const hasBackFeature = allHighlighted.some(slug => allBackSlugs.has(slug));

  const noMuscles = allHighlighted.length === 0;
  const showFront = noMuscles || hasFrontFeature;
  const showBack = noMuscles || hasBackFeature;
  const gridClass = showFront && showBack ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <Card>
      <CardContent className="p-4">
        <div className={`grid ${gridClass} gap-4`}>
          {showFront && (
            <BodyAnatomy
              view="front"
              primaryMuscles={primarySlugs}
              secondaryMuscles={secondarySlugs}
              colorScheme="grey"
              overrideViewBox={sharedViewBox}
              showCredit={false}
            />
          )}
          {showBack && (
            <BodyAnatomy
              view="back"
              primaryMuscles={primarySlugs}
              secondaryMuscles={secondarySlugs}
              colorScheme="grey"
              overrideViewBox={sharedViewBox}
              showCredit={false}
            />
          )}
        </div>
        <p className="text-center text-muted-foreground text-xs mt-3">
          {t('exerciseDetail.anatomyAttribution')} <a href="https://www.ryan-graves.com/" target="_blank" rel="noopener noreferrer" className="underline">Ryan Graves</a>, {t('exerciseDetail.ccLicense')} <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY 4.0</a> {t('exerciseDetail.license')}.
        </p>
      </CardContent>
    </Card>
  );
};

export default function ExerciseDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const sessions = useAccountSelector({
    select: (me) => me.root?.sessions
  });
  const { customExercises } = useCustomExercises();
  const { settings } = useSettings();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language as 'en' | 'es' | 'de';

  const displayUnit = settings?.weightUnit ?? 'kg';

  const libraryEntry = useMemo(() => {
    if (!templateId) return null;
    return masterLibrary[templateId] || customExercises?.find(c => c.$jazz.id === templateId) || null;
  }, [templateId, customExercises]);

  const exercise = useMemo(() => {
    if (!templateId) return null;
    const displayDetailed = settings?.trackingSettings?.displayDetailedMuscles ?? false;

    const masterExercises: TExerciseLibraryItem[] = Object.entries(masterLibrary).map(([id, ex]) => {
      const primaryMuscles = getDisplayMuscleNames({ specificKeys: ex.primaryMuscleKeys, displayDetailed, t });
      const secondaryMuscles = getDisplayMuscleNames({ specificKeys: ex.secondaryMuscleKeys, displayDetailed, t });

      return {
        id,
        name: ex.name[currentLang] || ex.name.en,
        bodyPart: t(`bodyParts.${ex.bodyPartKey}`),
        equipment: t(`equipment.${ex.equipmentKey}`),
        target: primaryMuscles[0] || 'N/A',
        primaryMuscles,
        secondaryMuscles,
        instructions: ex.instructions[currentLang] || ex.instructions.en,
      };
    });

    const fullLibrary: TExerciseLibraryItem[] = [
      ...masterExercises,
      ...(customExercises || []).map((ex: CustomExerciseResolved) => {
        const rawPrimaryKeys = (ex as any).primaryMuscleKeys || [(ex as any).target];
        const rawSecondaryKeys = (ex as any).secondaryMuscleKeys || (ex as any).secondaryMuscles || [];

        const primaryKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
        const secondaryKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));
        const primaryMuscles = getDisplayMuscleNames({ specificKeys: primaryKeys, displayDetailed, t });
        const secondaryMuscles = getDisplayMuscleNames({ specificKeys: secondaryKeys, displayDetailed, t });

        return {
          id: ex.$jazz.id,
          name: ex.name,
          bodyPart: ex.bodyPart,
          equipment: ex.equipment,
          target: primaryMuscles[0] || 'N/A',
          primaryMuscles,
          secondaryMuscles,
          instructions: ex.instructions?.slice() || [],
        };
      }),
    ];
    return fullLibrary.find((ex) => ex.id === templateId) || null;
  }, [templateId, customExercises, currentLang, t, settings]);

  const progressData = useMemo(() => {
    if (!sessions || !exercise) {
      return [];
    }
    const progress: Array<{
      workout: string;
      date: string;
      weight: number;
      reps: number;
      rir: number | null;
      e1rm: number;
      e10rm: number;
    }> = [];
    const completedSessions = sessions
      .filter((s): s is SessionWithRelations => !!s?.completedAt)
      .sort(
        (a, b) =>
          new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
      );
    for (const session of completedSessions) {
      const exerciseInstance = (session.exercises || []).find(
        (ex) => ex?.templateId === exercise.id && ex.sets.length > 0,
      );

      if (exerciseInstance) {
        const completedSets = (exerciseInstance.sets || []).filter(
          (s): s is SetResolved =>
            s?.status === 'completed' &&
            typeof s.weight === 'number' && s.weight > 0 &&
            typeof s.reps === 'number' && s.reps > 0
        );

        if (completedSets.length > 0) {
          let bestSet: SetResolved | null = null;
          let maxE1rm = 0;

          for (const set of completedSets) {
            const currentE1rm = calculateEpley1RM(set.weight!, set.reps!, set.rir ?? 0);
            if (currentE1rm > maxE1rm) {
              maxE1rm = currentE1rm;
              bestSet = set;
            }
          }

          if (bestSet && maxE1rm > 0) {
            const e10rm = getWeightForReps(maxE1rm, 10);
            progress.push({
              workout: `W${progress.length + 1}`,
              date: DateTime.fromJSDate(new Date(session.completedAt!)).setLocale(i18n.language).toLocaleString(DateTime.DATE_MED),
              weight: bestSet.weight!,
              reps: bestSet.reps!,
              rir: bestSet.rir ?? null,
              e1rm: parseFloat(maxE1rm.toFixed(1)),
              e10rm: parseFloat(e10rm.toFixed(1)),
            });
          }
        }
      }
    }
    return progress;
  }, [sessions, exercise]);

  const sessionHistory = useMemo(() => {
    if (!sessions || !exercise) {
      return [];
    }

    const history: Array<{
      sessionId: string;
      sessionName: string;
      date: string;
      totalPRs: number;
      completedSets: Array<SetResolved & {
        isNewE1RM_PR: boolean;
        isNewE10RM_PR: boolean;
        isNewVolume_PR: boolean;
      }>;
    }> = [];

    const chronoSessions = sessions
      .filter((s): s is SessionWithRelations => !!s?.completedAt)
      .sort(
        (a, b) =>
          new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
      );

    let bestE1RMSoFar = 0;
    let bestSetVolumeSoFar = 0;

    for (const session of chronoSessions) {
      const exerciseInstance = (session.exercises || []).find(
        (ex) => ex?.templateId === exercise.id,
      );

      if (!exerciseInstance) continue;

      const completedSets = (exerciseInstance.sets || []).filter(
        (s): s is SetResolved =>
          s?.status === 'completed' &&
          s.weight != null &&
          s.reps != null &&
          s.weight > 0 &&
          s.reps > 0
      );

      if (completedSets.length === 0) continue;

      let sessionBestE1RM = 0;
      let sessionBestSetVolume = 0;
      let sessionBestE1RMSetId: string | null = null;
      let sessionBestSetVolumeSetId: string | null = null;

      for (const set of completedSets) {
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

      const historicalBestE10RM = getWeightForReps(bestE1RMSoFar, 10);
      const sessionBestE10RM = getWeightForReps(sessionBestE1RM, 10);

      const isNewE1RM_PR = sessionBestE1RM > bestE1RMSoFar;
      const isNewE10RM_PR = sessionBestE10RM > historicalBestE10RM;
      const isNewVolume_PR = sessionBestSetVolume > bestSetVolumeSoFar;
      const totalPRs = [isNewE1RM_PR, isNewE10RM_PR, isNewVolume_PR].filter(Boolean).length;

      const analyzedSets = completedSets.map((set) => ({
        $jazz: set.$jazz,
        order: set.order,
        status: set.status,
        reps: set.reps,
        weight: set.weight,
        duration: set.duration,
        distance: set.distance,
        rir: set.rir,
        isNewE1RM_PR: isNewE1RM_PR && set.$jazz.id === sessionBestE1RMSetId,
        isNewE10RM_PR: isNewE10RM_PR && set.$jazz.id === sessionBestE1RMSetId,
        isNewVolume_PR: isNewVolume_PR && set.$jazz.id === sessionBestSetVolumeSetId,
      }));

      history.push({
        sessionId: session.$jazz.id,
        sessionName: session.name,
        date: DateTime.fromJSDate(new Date(session.completedAt!)).toRelative() || t('common.unknown'),
        totalPRs,
        completedSets: analyzedSets as any,
      });

      if (isNewE1RM_PR) bestE1RMSoFar = sessionBestE1RM;
      if (isNewVolume_PR) bestSetVolumeSoFar = sessionBestSetVolume;
    }

    return history.reverse();
  }, [sessions, exercise, displayUnit]);

  if (!exercise) {
    return <div className="text-center mt-10">{t('exerciseDetail.exerciseNotFound')}</div>;
  }

  const hasCharacteristics =
    libraryEntry &&
    ('compound' in libraryEntry && libraryEntry.compound ||
      'unilateral' in libraryEntry && libraryEntry.unilateral);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight capitalize">
          {exercise.name}
        </h1>
        <p className="text-muted-foreground capitalize">{exercise.target}</p>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">{t('exerciseDetail.overviewTab')}</TabsTrigger>
          <TabsTrigger value="progression">{t('exerciseDetail.progressionTab')}</TabsTrigger>
          <TabsTrigger value="history">{t('exerciseDetail.historyTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <ExerciseAnatomyView libraryEntry={libraryEntry} />
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('exerciseDetail.muscleEngagement')}</CardTitle>
                  {hasCharacteristics && (
                    <CardDescription className="flex flex-wrap gap-2 pt-2">
                      {libraryEntry && 'compound' in libraryEntry && libraryEntry.compound && (
                        <Badge variant="outline">{t('exerciseDetail.compound')}</Badge>
                      )}
                      {libraryEntry && 'unilateral' in libraryEntry && libraryEntry.unilateral && (
                        <Badge variant="outline">{t('exerciseDetail.unilateral')}</Badge>
                      )}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">{t('exerciseDetail.primaryMovers')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {(exercise.primaryMuscles ?? []).map((muscle) => (
                        <Badge key={muscle} variant="default" className="capitalize">
                          {muscle}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {(exercise.secondaryMuscles ?? []).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{t('exerciseDetail.secondaryMovers')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {(exercise.secondaryMuscles ?? []).map((muscle) => (
                          <Badge key={muscle} variant="secondary" className="capitalize">
                            {muscle}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('exerciseDetail.instructions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {exercise.instructions && exercise.instructions.length > 0 ? (
                    <ol className="list-inside list-decimal space-y-2 leading-relaxed text-muted-foreground">
                      {exercise.instructions.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-muted-foreground">{t('exerciseDetail.noInstructions')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progression">
          <Card>
            <CardHeader>
              <CardTitle>{t('exerciseDetail.performanceProgression')}</CardTitle>
              <CardDescription>
                {t('exerciseDetail.progressionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {progressData.length > 1 ? (
                <ChartContainer
                  config={chartConfig}
                  className="h-[300px] w-full"
                >
                  <LineChart
                    accessibilityLayer
                    data={progressData}
                    margin={{ top: 20, left: -15, right: 30, bottom: 5 }}
                  >
                    <CartesianGrid vertical strokeDasharray="3 3" />
                    <XAxis
                      dataKey="workout"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => `${value}kg`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent
                        indicator="line"
                        labelFormatter={(label, payload) => {
                          const date = payload[0]?.payload.date;
                          return date ? `${label} (${date})` : label;
                        }}
                      />}
                    />
                    <Legend />
                    <Line yAxisId="left" dataKey="e1rm" type="monotone" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ fill: "var(--color-chart-1)" }} activeDot={{ r: 6 }} />
                    <Line yAxisId="left" dataKey="e10rm" type="monotone" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ fill: "var(--color-chart-2)" }} activeDot={{ r: 6 }} />
                    <Line yAxisId="left" dataKey="weight" type="monotone" stroke="var(--color-chart-3)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ChartLine /></EmptyMedia>
                    <EmptyTitle>{t('exerciseDetail.notEnoughData')}</EmptyTitle>
                    <EmptyDescription>{t('exerciseDetail.notEnoughDataDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>{t('exerciseDetail.recentHistory')}</CardTitle>
              <CardDescription>
                {t('exerciseDetail.recentHistoryDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionHistory.length > 0 ? (
                <div className="border rounded-lg">
                  {sessionHistory.slice(0, 10).map((perf) => (
                    <Link key={perf.sessionId} to={`/session/${perf.sessionId}`}>
                      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                        <div className="p-3 md:border-r">
                          <h3 className="font-semibold text-sm">{perf.sessionName}</h3>
                          <p className="text-xs text-muted-foreground mb-1.5">{perf.date}</p>
                          {perf.totalPRs > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Medal className="size-3 mr-1" />
                              {perf.totalPRs} {perf.totalPRs > 1 ? t('summary.newRecords') : t('summary.newRecord')}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="space-y-1.5">
                            {perf.completedSets.map((set) => {
                              const prs: string[] = [];
                              if (set.isNewVolume_PR) prs.push(t('summary.volume'));
                              if (set.isNewE1RM_PR) prs.push(t('common.e1rm'));
                              if (set.isNewE10RM_PR) prs.push(t('common.e10rm'));

                              return (
                                <div key={set.$jazz.id} className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-x-2 gap-y-1 text-xs">
                                  <span className="font-mono text-muted-foreground whitespace-nowrap">
                                    {t('common.sets', { count: set.order + 1 })}: {convertKgToDisplay(set.weight!, displayUnit)}{displayUnit} &times; {set.reps}
                                    {set.rir != null ? ` @ ${set.rir}${t('common.rir')}` : ''}
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
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><History /></EmptyMedia>
                    <EmptyTitle>{t('exerciseDetail.noHistoryFound')}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}