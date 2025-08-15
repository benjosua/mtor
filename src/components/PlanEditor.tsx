import { useAccountSelector } from "@/components/AccountProvider";
import { useDialog } from "@/components/DialogProvider";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { masterLibrary } from "@/data/master-library";
import { usePrimaryMuscleKeys } from "@/hooks/usePrimaryMuscleKeys";
import { useResolvedExerciseDetails } from "@/hooks/useResolvedExercise";
import {
    addDayToPlan,
    addExerciseToPlanDay,
    deleteDayFromPlan,
    deleteExerciseFromPlanDay,
    duplicateDayInPlan,
    remapExerciseTemplateId,
    reorderDaysInPlan,
    reorderExercisesInPlanDay,
    swapExerciseInPlanDay,
    updateDayInPlan,
    updateExerciseInPlanDay,
    updatePlan,
    useCustomExercises,
    usePlan,
    useSettings,
    type PlanDayWithRelations,
    type PlanExerciseResolved
} from "@/jazz/db";
import { libraryKeyToAnatomySlug, stretchMediatedHypertrophyMuscles } from "@/lib/muscleUtils";
import { analyzePlanVolume } from "@/lib/planAnalyzer";
import { getPlanDayData, getPlanExerciseData, isPlanDayData, isPlanExerciseData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ClipboardPlus, Clock, Copy, Ellipsis, Plus, Repeat, Replace, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import invariant from "tiny-invariant";
import { useDebounceCallback } from 'usehooks-ts';
import { toast } from "sonner";
import { backBodyPartData } from './backBodyPartDataIndexed';
import { BodyAnatomy, type BodyPartData, type MuscleSlug } from "./BodyAnatomy";
import { DropIndicator } from "./drop-indicator";
import { ExerciseSearch } from "./ExerciseSearch";
import { frontBodyPartData } from './frontBodyPartDataIndexed';
import { PlanAnalysisDisplay } from "./PlanAnalysisDisplay";
import { PlanTargetInput } from "./PlanTargetInput";
import { Input } from "./ui/input";
import { UnresolvedExerciseCard } from './UnresolvedExerciseCard'; 

type DraggableState = { type: 'idle' } | { type: 'preview', container: HTMLElement } | { type: 'is-dragging' } | { type: 'is-dragging-over', closestEdge: Edge | null };
const idle: DraggableState = { type: 'idle' };

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

const MuscleGroupSummary = ({ exercises, scope }: { exercises: PlanExerciseResolved[]; scope: 'plan' | 'day' }) => {
    const { t } = useTranslation();
    const summary = useMemo(() => {
        let totalSets = 0;
        const targetMuscleMap = new Map<string, number>();
        const bodyPartMap = new Map<string, number>();
        const secondaryMuscleMap = new Map<string, number>();

        for (const exercise of exercises) {
            if (!exercise) continue;
            const sets = exercise.targetSets ?? 0;
            if (sets === 0) continue;

            totalSets += sets;

            const libEntry = masterLibrary[exercise.templateId];
            if (libEntry) {
                const primary = libEntry.primaryMuscleKeys;
                const secondary = libEntry.secondaryMuscleKeys;
                const bodyPart = libEntry.bodyPartKey;

                if (primary.length > 0) {
                    const target = primary[0];
                    targetMuscleMap.set(target, (targetMuscleMap.get(target) ?? 0) + sets);
                }

                if (bodyPart) {
                    bodyPartMap.set(bodyPart, (bodyPartMap.get(bodyPart) ?? 0) + sets);
                }

                secondary.forEach((muscle: string) => {
                    if (muscle) {
                        secondaryMuscleMap.set(muscle, (secondaryMuscleMap.get(muscle) ?? 0) + sets);
                    }
                });
            }

        }

        const sortedTargets = Array.from(targetMuscleMap.entries()).sort((a, b) => b[1] - a[1]);
        const sortedBodyParts = Array.from(bodyPartMap.entries()).sort((a, b) => b[1] - a[1]);
        const sortedSecondary = Array.from(secondaryMuscleMap.entries()).sort((a, b) => b[1] - a[1]);

        return { totalSets, sortedTargets, sortedBodyParts, sortedSecondary };
    }, [exercises]);

    if (summary.totalSets === 0) {
        return null;
    }

    const triggerText = scope === 'plan' ? t('planEditor.planVolume') : t('planEditor.workoutVolume');

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="muscle-summary" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">{triggerText}</AccordionTrigger>
                <AccordionContent>
                    <div className="flex flex-wrap gap-1.5 items-center pt-2">
                        <Badge variant="outline">
                            Total Sets: <span className="font-mono text-xs ml-1.5 bg-muted text-muted-foreground px-1 rounded">{summary.totalSets}</span>
                        </Badge>
                        {summary.sortedBodyParts.map(([part, sets]) => (
                            <Badge key={part} variant="outline" className="capitalize">
                                BP: {part} <span className="font-mono text-xs ml-1.5 bg-muted text-muted-foreground px-1 rounded">{sets}</span>
                            </Badge>
                        ))}
                        {summary.sortedTargets.map(([muscle, sets]) => (
                            <Badge key={muscle} variant="outline" className="capitalize">
                                TM: {muscle} <span className="font-mono text-xs ml-1.5 bg-muted text-muted-foreground px-1 rounded">{sets}</span>
                            </Badge>
                        ))}
                        {summary.sortedSecondary.map(([muscle, sets]) => (
                            <Badge key={muscle} variant="outline" className="capitalize">
                                SM: {muscle} <span className="font-mono text-xs ml-1.5 bg-muted text-muted-foreground px-1 rounded">{sets}</span>
                            </Badge>
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

const DraggableTabTrigger = ({ day, isFirst, isLast, onDeleteDay, onMoveDay, onDuplicateDay }: { day: PlanDayWithRelations; isFirst: boolean; isLast: boolean; onDeleteDay: (dayId: string, dayName: string) => void; onMoveDay: (dayId: string, direction: 'left' | 'right') => void; onDuplicateDay: (dayId: string) => void; }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<DraggableState>(idle);

    useEffect(() => {
        const element = ref.current;
        invariant(element);
        return combine(
            draggable({ element, getInitialData: () => getPlanDayData(day), onDragStart: () => setState({ type: 'is-dragging' }), onDrop: () => setState(idle) }),
            dropTargetForElements({ element, canDrop: ({ source }) => isPlanDayData(source.data), getData: ({ input }) => attachClosestEdge(getPlanDayData(day), { element, input, allowedEdges: ['left', 'right'] }), onDragEnter: ({ self }) => setState({ type: 'is-dragging-over', closestEdge: extractClosestEdge(self.data) }), onDragLeave: () => setState(idle), onDrop: () => setState(idle) })
        );
    }, [day]);

    return (
        <div ref={ref} className="relative">
            <TabsTrigger value={day.$jazz.id} className={clsx('pr-8 relative cursor-grab', { 'opacity-30': state.type === 'is-dragging' })}>
                {day.name || `New Day`}
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}><Button variant="ghost" size="icon" className="size-8 h-full rounded-l-none cursor-pointer"><Ellipsis className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onMoveDay(day.$jazz.id, 'left')} disabled={isFirst}><ArrowUp className="mr-2 size-4 -rotate-90" /> Move Left</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMoveDay(day.$jazz.id, 'right')} disabled={isLast}><ArrowDown className="mr-2 size-4 -rotate-90" /> Move Right</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicateDay(day.$jazz.id)}>
                                <Copy className="mr-2 size-4" /> Duplicate Day
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteDay(day.$jazz.id, day.name)}><Trash2 className="mr-2 size-4" /> Delete Day</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TabsTrigger>
            {state.type === 'is-dragging-over' && state.closestEdge && <DropIndicator edge={state.closestEdge} gap="0px" />}
        </div>
    );
};

export function PlanEditor({ planId }: { planId: string }) {
    const { plan, fetching } = usePlan(planId);
    const sessions = useAccountSelector({
        select: (me) => me.root?.sessions
    });
    const { customExercises } = useCustomExercises();
    const { confirm } = useDialog();
    const { t } = useTranslation();
    const [isSearchOpen, setIsSearchOpen] = useState<string | null>(null);
    const [exerciseToRemap, setExerciseToRemap] = useState<PlanExerciseResolved | null>(null);
    const [exerciseToSwap, setExerciseToSwap] = useState<PlanExerciseResolved | null>(null);
    const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
    const [selectedMuscle, setSelectedMuscle] = useState<MuscleSlug | null>(null);
    const [anatomyViewBox, setAnatomyViewBox] = useState<string | null>(null);

    const resolvedRemapSourceDetails = useResolvedExerciseDetails(exerciseToRemap);

    const debouncedPlanRename = useDebounceCallback(() => {
    }, 1000);

    const debouncedDayRename = useDebounceCallback(() => {
    }, 1000);

    useEffect(() => {
        if (plan?.days && plan.days.length > 0) {
            const currentTabExists = plan.days.some(d => d?.$jazz.id === activeTab);
            if (!activeTab || !currentTabExists) {
                setActiveTab(plan.days[0]?.$jazz.id);
            }
        } else {
            setActiveTab(undefined);
        }
    }, [plan?.days, activeTab]);

    const planAnalysis = useMemo(() => {
        if (!plan || !customExercises || !sessions) return null;
        return analyzePlanVolume(plan, customExercises, [...sessions], t);
    }, [plan, customExercises, sessions, t]);

    const allExercises = useMemo(() => {
        return plan?.days?.flatMap(day => day?.exercises ?? [])?.filter((e): e is PlanExerciseResolved => !!e) ?? [];
    }, [plan]);

    const muscleFatigue = useMemo(() => {
        const muscleSetCounts = new Map<MuscleSlug, number>();
        if (!allExercises.length) return {};

        const processKey = (key: string | undefined, weight: number) => {
            if (!key) return;
            const slugsOrSlug = libraryKeyToAnatomySlug[key];
            if (!slugsOrSlug) return;

            const slugs = Array.isArray(slugsOrSlug) ? slugsOrSlug : [slugsOrSlug];

            for (const slug of slugs) {
                if (slug !== 'unknown') {
                    muscleSetCounts.set(slug, (muscleSetCounts.get(slug) ?? 0) + weight);
                }
            }
        };

        for (const exercise of allExercises) {
            const sets = exercise.targetSets ?? 0;
            if (sets === 0) continue;

            const libraryEntry = masterLibrary[exercise.templateId];
            const customEntry = customExercises?.find(c => c.$jazz.id === exercise.templateId);

            let primaryMuscleKeys: string[] = [];
            let secondaryMuscleKeys: string[] = [];

            if (libraryEntry) {
                primaryMuscleKeys = libraryEntry.primaryMuscleKeys as string[];
                secondaryMuscleKeys = libraryEntry.secondaryMuscleKeys as string[];
            } else if (customEntry) {
                const rawPrimaryKeys = (customEntry as any).primaryMuscleKeys || [(customEntry as any).target];
                const rawSecondaryKeys = (customEntry as any).secondaryMuscleKeys || (customEntry as any).secondaryMuscles || [];

                primaryMuscleKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
                secondaryMuscleKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));
            }

            primaryMuscleKeys.forEach(key => processKey(key, sets));
            secondaryMuscleKeys.forEach(key => processKey(key, sets * 0.5));
        }

        if (muscleSetCounts.size === 0) return {};

        const maxSets = Math.max(...muscleSetCounts.values());
        if (maxSets === 0) return {};

        const fatigueMap: Partial<Record<MuscleSlug, number>> = {};
        for (const [muscle, count] of muscleSetCounts.entries()) {
            fatigueMap[muscle] = count / maxSets;
        }

        return fatigueMap;
    }, [allExercises, customExercises]);

    const exerciseNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const [id, exercise] of Object.entries(masterLibrary)) {
            map.set(id, exercise.name.en);
        }
        (customExercises ?? []).forEach(ex => {
            map.set(ex.$jazz.id, ex.name);
        });
        return map;
    }, [customExercises]);

    const FULL_SLUG_MAP: { [key: string]: MuscleSlug } = {
        "outline": "outline", "Hands": "hands", "Feet": "feet", "Ankle": "ankles", "Head": "unknown", "Tibialis Anterior": "tibialis-anterior", "Soleus": "soleus", "Gastrocnemius": "gastrocnemius", "quadricepsVasti": "quadricepsVasti", "rectus-femoris": "rectus-femoris", "Hip Adductors": "adductors", "Sartorius": "sartorius", "Hip Flexors": "hip-flexors", "Hamstrings": "hamstrings", "Gluteus_Maximus": "gluteus-maximus", "Abductors": "abductors", "calves": "calves", "Wrist Flexors": "wrist-flexors", "Wrist Extensors": "wrist-extensors", "Pronators": "pronators", "Brachialis": "brachialis", "Triceps Brachii": "triceps", "Brachioradialis": "brachioradialis", "Biceps Brachii": "biceps", "Obliques": "obliques", "Latissimus Dorsi & Teres Major": "lats", "Rectus Abdominis": "abdominals", "Pectoralis Major": "pectorals", "Scalenes": "neck", "Sternocleidomastoid": "neck",
        "Deltoid Anterior": "deltoid-anterior", "Deltoid Medial/Lateral": "deltoid-lateral", "Deltoid Posterior": "deltoid-posterior",
        "Trapezius Upper": "trapezius-upper", "Trapezius Middle": "trapezius-middle", "Trapezius Lower": "trapezius-lower",
        "Quadriceps": "quadriceps"
    };
    useEffect(() => {
        if (!selectedMuscle) {
            setAnatomyViewBox(null);
            return;
        }

        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.cssText = 'position:absolute; visibility:hidden; width:0; height:0;';

        const processData = (data: BodyPartData[], isBack: boolean) => {
            data.forEach(part => {
                const unifiedSlug = FULL_SLUG_MAP[part.slug] || 'unknown';
                if (selectedMuscle === unifiedSlug) {
                    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    pathEl.setAttribute('d', part.pathArray.join(' '));
                    if (isBack) {
                        pathEl.setAttribute('transform', 'translate(596, 0)');
                    }
                    tempSvg.appendChild(pathEl);
                }
            });
        };

        processData(frontBodyPartData, false);
        processData(backBodyPartData, true);

        document.body.appendChild(tempSvg);
        const overallBBox = tempSvg.getBBox();
        document.body.removeChild(tempSvg);

        if (overallBBox && overallBBox.width > 0 && overallBBox.height > 0) {
            const { x, y, width, height } = overallBBox;
            const centerX = x + width / 2;
            const centerY = y + height / 2;

            const size = Math.max(width, height);
            const paddedSize = size * 1.6;

            const newX = centerX - paddedSize / 2;
            const newY = centerY - paddedSize / 2;

            setAnatomyViewBox(`${newX} ${newY} ${paddedSize} ${paddedSize}`);
        } else {
            setAnatomyViewBox(null);
        }
    }, [selectedMuscle]);

    const selectedMuscleDetails = useMemo(() => {
        if (!selectedMuscle || !plan) return null;

        const contributingExercises: { day: PlanDayWithRelations; exercise: PlanExerciseResolved }[] = [];

        for (const day of plan.days || []) {
            if (!day) continue;
            for (const exercise of day.exercises || []) {
                if (!exercise) continue;

                const libraryEntry = masterLibrary[exercise.templateId];
                const customEntry = customExercises?.find(c => c.$jazz.id === exercise.templateId);

                let primaryMuscleKeys: string[] = [];
                let secondaryMuscleKeys: string[] = [];

                if (libraryEntry) {
                    primaryMuscleKeys = libraryEntry.primaryMuscleKeys as string[];
                    secondaryMuscleKeys = libraryEntry.secondaryMuscleKeys as string[];
                } else if (customEntry) {
                    const rawPrimaryKeys = (customEntry as any).primaryMuscleKeys || [(customEntry as any).target];
                    const rawSecondaryKeys = (customEntry as any).secondaryMuscleKeys || (customEntry as any).secondaryMuscles || [];
                    primaryMuscleKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
                    secondaryMuscleKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));
                }

                const allMuscleKeys = [...primaryMuscleKeys, ...secondaryMuscleKeys];
                let isMatch = false;
                for (const key of allMuscleKeys) {
                    const slugsOrSlug = libraryKeyToAnatomySlug[key];
                    if (!slugsOrSlug) continue;
                    const slugs = Array.isArray(slugsOrSlug) ? slugsOrSlug : [slugsOrSlug];
                    if (slugs.includes(selectedMuscle)) {
                        isMatch = true;
                        break;
                    }
                }

                if (isMatch) {
                    contributingExercises.push({ day, exercise });
                }
            }
        }

        const groupedByDay = contributingExercises.reduce((acc, { day, exercise }) => {
            let dayGroup = acc.find(d => d.dayId === day.$jazz.id);
            if (!dayGroup) {
                dayGroup = { dayId: day.$jazz.id, dayName: day.name, exercises: [] };
                acc.push(dayGroup);
            }
            dayGroup.exercises.push(exercise);
            return acc;
        }, [] as { dayId: string, dayName: string, exercises: PlanExerciseResolved[] }[]);

        const muscleName = selectedMuscle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return {
            muscleName,
            muscleSlug: selectedMuscle,
            details: groupedByDay,
        };
    }, [selectedMuscle, plan, customExercises, exerciseNameMap]);

    useEffect(() => {
        if (!plan) return;
        return monitorForElements({
            onDrop({ location, source }) {
                if (!plan) return;
                const target = location.current.dropTargets[0];
                if (!target) return;

                const sourceData = source.data;
                const targetData = target.data;
                const closestEdge = extractClosestEdge(targetData);
                if (!closestEdge) return;

                if (isPlanDayData(sourceData) && isPlanDayData(targetData)) {
                    if (closestEdge !== 'left' && closestEdge !== 'right') return;
                    const reorderEdge = closestEdge === 'left' ? 'top' : 'bottom';
                    reorderDaysInPlan(plan, sourceData.dayId, targetData.dayId, reorderEdge);
                }
                if (isPlanExerciseData(sourceData) && isPlanExerciseData(targetData)) {
                    if (sourceData.dayId !== targetData.dayId) return;
                    if (closestEdge !== 'top' && closestEdge !== 'bottom') return;
                    const day = plan.days?.find(d => d?.$jazz.id === sourceData.dayId);
                    if (day) {
                        reorderExercisesInPlanDay(day, sourceData.exerciseId, targetData.exerciseId, closestEdge);
                    }
                }
            },
        });
    }, [plan]);

    const handleAddDay = () => {
        if (!plan) return;
        const newDayId = addDayToPlan(plan);
        if (typeof newDayId === 'string') {
            setActiveTab(newDayId);
        }
    };

    const handleDuplicateDay = (dayId: string) => {
        if (!plan) return;
        const newDayId = duplicateDayInPlan(plan, dayId);
        if (newDayId) {
            setActiveTab(newDayId);
        }
    };

    const handleSelectExercise = async (selectedExerciseId: string) => {
        if (!plan) return;

        if (exerciseToRemap) {
            const oldName = resolvedRemapSourceDetails?.name || 'the old exercise';
            const newName = exerciseNameMap.get(selectedExerciseId) || 'the new exercise';

            confirm({
                title: t('planEditor.updateHistoryTitle'),
                description: (
                    <>
                        <p className="font-semibold text-lg">{t('planEditor.replaceInfo')}</p>
                        <p className="text-center text-destructive">"{oldName}"</p>
                        <p className="font-semibold text-lg mt-2">{t('planEditor.withInfo')}</p>
                        <p className="text-center text-primary">"{newName}"</p>
                        <p className="mt-4 text-sm text-muted-foreground">
                            {t('planEditor.updateHistoryDescription')}
                        </p>
                    </>
                ),
                confirmText: t('planEditor.updateHistoryConfirm'),
                onConfirm: async () => {
                    await remapExerciseTemplateId(exerciseToRemap.templateId, selectedExerciseId);
                    setExerciseToRemap(null);
                    setIsSearchOpen(null);
                }
            });
        } else if (exerciseToSwap && isSearchOpen) {
            const day = plan.days?.find(d => d?.$jazz.id === isSearchOpen);
            if (day) {
                await swapExerciseInPlanDay(day, exerciseToSwap.$jazz.id, selectedExerciseId);
                toast.success(t('planEditor.exerciseSwapped', 'Exercise swapped.'));
            }
            setIsSearchOpen(null);
            setExerciseToSwap(null);
        } else if (isSearchOpen) {
            const day = plan.days?.find(d => d?.$jazz.id === isSearchOpen);
            if (day) {
                await addExerciseToPlanDay(day, selectedExerciseId);
                toast.success(t('planEditor.exerciseAdded', 'Exercise added.'));
            }
            setIsSearchOpen(null);
        }
    };

    const handleDeleteDay = (dayId: string, dayName: string) => {
        if (!plan || !plan.days) return;
        confirm({
            title: `Delete Day "${dayName}"?`, description: "All exercises within this day will be removed. This cannot be undone.", confirmText: "Delete", onConfirm: () => {
                if (activeTab === dayId) {
                    const dayIndex = plan.days!.findIndex(d => d?.$jazz.id === dayId);
                    if (dayIndex > 0) setActiveTab(plan.days![dayIndex - 1]?.$jazz.id);
                    else if (plan.days!.length > 1) setActiveTab(plan.days![1]?.$jazz.id);
                }
                deleteDayFromPlan(plan, dayId);
                toast.success(t('planEditor.dayDeleted', 'Day deleted.'));
            }
        });
    };

    const handleDeleteExercise = (dayId: string, exerciseId: string, exerciseName: string) => {
        if (!plan) return;
        const day = plan.days?.find(d => d?.$jazz.id === dayId);
        if (!day) return;
        confirm({
            title: `Delete "${exerciseName}"?`, description: "This exercise will be removed from the day. This cannot be undone.", confirmText: "Delete", onConfirm: () => {
                deleteExerciseFromPlanDay(day, exerciseId);
                toast.success(t('planEditor.exerciseDeleted', 'Exercise deleted.'));
            }
        });
    };

    const handleMoveDay = (dayId: string, direction: 'left' | 'right') => {
        if (!plan || !plan.days) return;
        const fromIndex = plan.days?.findIndex((d) => d?.$jazz.id === dayId);
        if (fromIndex === undefined || fromIndex === -1) return;
        const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= (plan.days?.length ?? 0)) return;
        const targetId = plan.days[toIndex]?.$jazz.id;
        if (targetId) {
            reorderDaysInPlan(plan, dayId, targetId, direction === 'left' ? 'top' : 'bottom');
        }
    };

    const handleMoveExercise = (dayId: string, exerciseId: string, direction: 'up' | 'down') => {
        if (!plan) return;
        const day = plan.days?.find((d) => d?.$jazz.id === dayId);
        if (!day) return;
        const fromIndex = day.exercises?.findIndex((e) => e?.$jazz.id === exerciseId);
        if (fromIndex === undefined || fromIndex === -1) return;
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= (day.exercises?.length ?? 0)) return;
        const targetId = day.exercises[toIndex]?.$jazz.id;
        if (targetId) {
            reorderExercisesInPlanDay(day, exerciseId, targetId, direction === 'up' ? 'top' : 'bottom');
        }
    };

    if (fetching) return <Card className="p-4"><div className="font-semibold">Loading plan...</div></Card>;
    if (!plan) return <Card className="p-4"><div className="font-semibold">Plan not found.</div></Card>;

    const days = plan.days?.filter((d): d is PlanDayWithRelations => !!d) ?? [];

    return (
        <>
            <div className="space-y-5">
                <div className="flex gap-4 items-center">
                    <Input value={plan.name} onChange={(e) => {
                        updatePlan(plan, { name: e.target.value });
                        debouncedPlanRename();
                    }} className="text-3xl font-bold tracking-tight" placeholder={t('planEditor.myAwesomePlan')} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button asChild variant="outline"><Link to="/">{t('common.done')}</Link></Button>
                    </div>
                </div>

                <Tabs defaultValue="editor" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="editor">{t('planEditor.editor')}</TabsTrigger>
                        <TabsTrigger value="analysis">{t('planEditor.analysis')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="editor" className="pt-4">
                        {days.length === 0 ? (
                            <Empty className="py-16 border-2 border-dashed rounded-lg">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon"><ClipboardPlus /></EmptyMedia>
                                    <EmptyTitle>{t('planEditor.planEmpty')}</EmptyTitle>
                                    <EmptyDescription>{t('planEditor.clickAddDay')}</EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button variant="outline" onClick={handleAddDay}>
                                        <Plus className="size-4 mr-1" /> {t('planEditor.addDay')}
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        ) : (
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="h-auto p-1 gap-1">
                                    <AnimatePresence>
                                        {days.map((day, index) => (
                                            <motion.div
                                                key={day.$jazz.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                                className="flex"
                                            >
                                                <DraggableTabTrigger day={day} isFirst={index === 0} isLast={days.length - 1 === index} onDeleteDay={handleDeleteDay} onMoveDay={handleMoveDay} onDuplicateDay={handleDuplicateDay} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    <Button variant="ghost" onClick={handleAddDay} className="h-full px-3 self-center ml-1 text-muted-foreground hover:text-foreground">
                                        <Plus className="size-4" />
                                    </Button>
                                </TabsList>

                                {days.map((day, index) => {
                                    const exercises = day.exercises?.filter((e): e is PlanExerciseResolved => !!e) ?? [];
                                    return (
                                        <TabsContent key={day.$jazz.id} value={day.$jazz.id} className="mt-4">
                                            <Card className="p-4">
                                                <Input value={day.name} onChange={e => {
                                                    updateDayInPlan(day, { name: e.target.value });
                                                    debouncedDayRename();
                                                }} className="text-2xl font-semibold border-0 bg-transparent mb-2 -mx-2" placeholder={`${t('planEditor.newDay')} ${index + 1}`} />

                                                <div className="mb-4">
                                                    <MuscleGroupSummary exercises={exercises} scope="day" />
                                                </div>

                                                <div className="space-y-1">
                                                    <AnimatePresence>
                                                        {exercises.map((exercise, idx) => (
                                                            (() => {
                                                                const isOrphan = !exercise.templateId && exercise.name;

                                                                if (isOrphan) {
                                                                    return (
                                                                        <UnresolvedExerciseCard
                                                                            key={exercise.$jazz.id}
                                                                            exercise={exercise as any} // Cast because it has old fields
                                                                            plan={plan}
                                                                        />
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <PlanExerciseItem
                                                                            key={exercise.$jazz.id}
                                                                            dayId={day.$jazz.id}
                                                                            exercise={exercise}
                                                                            isFirst={idx === 0}
                                                                            isLast={exercises.length - 1 === idx}
                                                                            onDelete={handleDeleteExercise}
                                                                            onMove={handleMoveExercise}
                                                                            onRemap={() => { setExerciseToRemap(exercise); setIsSearchOpen(day.$jazz.id); }}
                                                                            onSwap={() => { setExerciseToSwap(exercise); setIsSearchOpen(day.$jazz.id); }}
                                                                        />
                                                                    );
                                                                }
                                                            })()
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => { setExerciseToRemap(null); setIsSearchOpen(day.$jazz.id); }} className="mt-4 ml-2"><Plus className="size-4 mr-2" /> {t('planEditor.addExercise')}</Button>
                                            </Card>
                                        </TabsContent>
                                    )
                                })}
                            </Tabs>
                        )}
                    </TabsContent>

                    <TabsContent value="analysis" className="pt-4 space-y-4">
                        <PlanAnalysisDisplay analysis={planAnalysis} t={t} />
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {selectedMuscleDetails ? t('planEditor.muscleDetails', { muscleName: selectedMuscleDetails.muscleName }) : t('planEditor.muscleFatigue')}
                                </CardTitle>
                                <CardDescription>
                                    {selectedMuscleDetails
                                        ? t('planEditor.muscleDetailsDescription')
                                        : t('planEditor.muscleFatigueDescription')
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <AnimatePresence>
                                        {selectedMuscle && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                                <Badge
                                                    variant="secondary"
                                                    className="absolute top-0 left-0 z-10 cursor-pointer hover:bg-muted"
                                                    onClick={() => setSelectedMuscle(null)}
                                                >
                                                    <X className="size-3 mr-1.5" /> {t('planEditor.resetView')}
                                                </Badge>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <motion.div
                                        layout="position"
                                        transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 25 }}
                                        className="grid md:grid-cols-2 gap-x-6 items-start pt-8"
                                    >
                                        <motion.div
                                            layout="position"
                                            className={clsx('transition-all', selectedMuscle ? "md:col-span-1" : "md:col-span-2")}
                                        >
                                            <BodyAnatomy
                                                view="dual"
                                                primaryMuscles={selectedMuscle ? [selectedMuscle] : []}
                                                muscleFatigue={selectedMuscle ? {} : muscleFatigue}
                                                overrideViewBox={anatomyViewBox}
                                                onMuscleClick={setSelectedMuscle}
                                                colorScheme="grey"
                                            />
                                        </motion.div>

                                        <AnimatePresence>
                                            {selectedMuscle && selectedMuscleDetails && (
                                                <motion.div
                                                    layout="position"
                                                    className="md:col-span-1"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                                        {selectedMuscleDetails.details.length > 0 ? (
                                                            selectedMuscleDetails.details.map(({ dayId, dayName, exercises }) => (
                                                                <div key={dayId}>
                                                                    <h4 className="font-semibold mb-1.5">{dayName || t('planEditor.unnamedDay')}</h4>
                                                                    <div className="border rounded-md divide-y">
                                                                        {exercises.map(ex => (
                                                                            <div key={ex.$jazz.id} className="p-2 text-sm flex justify-between items-center">
                                                                                <span>{exerciseNameMap.get(ex.templateId)}</span>
                                                                                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                                    {ex.targetSets} sets
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-muted-foreground text-sm">{t('planEditor.noExercisesTargeted')}</p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <ExerciseSearch
                isOpen={isSearchOpen !== null}
                onClose={() => { setIsSearchOpen(null); setExerciseToRemap(null); setExerciseToSwap(null); }}
                onSelectExercise={handleSelectExercise}
                exerciseToRemap={exerciseToRemap ?? undefined}
                exerciseToSwap={exerciseToSwap ?? undefined}
            />
        </>
    );
};

const PlanExerciseItem = ({ dayId, exercise, isFirst, isLast, onDelete, onMove, onRemap, onSwap }: {
    dayId: string;
    exercise: PlanExerciseResolved;
    isFirst: boolean;
    isLast: boolean;
    onDelete: (dayId: string, exerciseId: string, exerciseName: string) => void;
    onMove: (dayId: string, exerciseId: string, direction: 'up' | 'down') => void;
    onRemap: () => void;
    onSwap: () => void;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<DraggableState>(idle);
    const { prompt } = useDialog();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const globalUnit = settings?.weightUnit ?? 'kg';
    const resolvedDetails = useResolvedExerciseDetails(exercise);
    const primaryMuscleKeys = usePrimaryMuscleKeys(exercise.templateId);

    const hasSmhMuscle = useMemo(() =>
        primaryMuscleKeys.some(key => stretchMediatedHypertrophyMuscles.has(key as string)),
        [primaryMuscleKeys]
    );

    useEffect(() => {
        const element = ref.current;
        invariant(element);
        return combine(
            draggable({ element, getInitialData: () => getPlanExerciseData(exercise, dayId), onGenerateDragPreview: ({ nativeSetDragImage }) => setCustomNativeDragPreview({ nativeSetDragImage, getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }), render: ({ container }) => setState({ type: 'preview', container }) }), onDragStart: () => setState({ type: 'is-dragging' }), onDrop: () => setState(idle) }),
            dropTargetForElements({ element, canDrop: ({ source }) => isPlanExerciseData(source.data) && source.data.dayId === dayId, getData: ({ input }) => attachClosestEdge(getPlanExerciseData(exercise, dayId), { element, input, allowedEdges: ['top', 'bottom'] }), onDragEnter: ({ self }) => setState({ type: 'is-dragging-over', closestEdge: extractClosestEdge(self.data) }), onDragLeave: () => setState(idle), onDrop: () => setState(idle) })
        );
    }, [dayId, exercise]);

    const handleSetRestTime = () => {
        prompt({
            title: t('planEditor.setRestTimeOverride'),
            description: t('planEditor.setRestTimeDescription'),
            inputType: "number",
            placeholder: t('planEditor.restTimePlaceholder'),
            defaultValue: exercise.restBetweenSets?.toString() ?? '',
            onConfirm: (value) => {
                const seconds = parseInt(value, 10);
                const newRestTime = isNaN(seconds) || seconds <= 0 ? undefined : seconds;
                updateExerciseInPlanDay(exercise, { restBetweenSets: newRestTime });
            },
        });
    };

    return (
        <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="relative group cursor-grab rounded-md" ref={ref}>
            <div className={clsx('p-2 transition-colors', { 'opacity-30': state.type === 'is-dragging', 'bg-muted/50': state.type === 'is-dragging-over' })}>
                <div className="flex items-center justify-between gap-2">
                    <p className="font-medium flex-1 flex items-center">{resolvedDetails?.name}{hasSmhMuscle && <SmhHint />}</p>
                    {exercise.sideType && exercise.sideType !== 'bilateral' && (
                        <Badge variant="outline" className="text-xs ml-2 capitalize">
                            {exercise.sideType.replace('unilateral_', '')}
                        </Badge>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <PlanTargetInput
                            initialSets={exercise.targetSets}
                            initialReps={exercise.targetReps}
                            onSave={({ sets, reps }) => updateExerciseInPlanDay(exercise, { targetSets: sets, targetReps: reps })}
                        >
                            <Button variant="outline" className="h-auto justify-center gap-2 px-3 py-1.5 font-normal">
                                <div className="flex w-10 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{exercise.targetSets ?? "-"}</span><span className="text-xs text-muted-foreground">sets</span></div>
                                <X size={14} className="shrink-0 text-muted-foreground" />
                                <div className="flex w-16 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{exercise.targetReps ?? "-"}</span><span className="text-xs text-muted-foreground">reps</span></div>
                            </Button>
                        </PlanTargetInput>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 cursor-pointer"> <Ellipsis className="size-5" /> </Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onMove(dayId, exercise.$jazz.id, 'up')} disabled={isFirst}><ArrowUp className="mr-2 size-4" /> Move Up</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove(dayId, exercise.$jazz.id, 'down')} disabled={isLast}><ArrowDown className="mr-2 size-4" /> Move Down</DropdownMenuItem>
                                <DropdownMenuItem onClick={onSwap}>
                                    <Replace className="mr-2 size-4" />
                                    <span>{t('exercise.swapExercise')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onRemap}>
                                    <Repeat className="mr-2 size-4" />
                                    <span>{t('planEditor.updateInHistory')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleSetRestTime}>
                                    <Clock className="mr-2 size-4" />
                                    <span>{exercise.restBetweenSets ? t('planEditor.setRest', { seconds: exercise.restBetweenSets }) : t('planEditor.setRestTime')}</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={exercise.weightUnit === undefined}
                                    onCheckedChange={(checked) => checked && updateExerciseInPlanDay(exercise, { weightUnit: undefined })}
                                >
                                    {t('planEditor.defaultUnit', { unit: globalUnit })}
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuRadioGroup
                                    value={exercise.sideType ?? 'bilateral'}
                                    onValueChange={(value) => {
                                        const newSideType = value === 'bilateral' ? undefined : value as PlanExerciseResolved['sideType'];
                                        updateExerciseInPlanDay(exercise, { sideType: newSideType });
                                    }}
                                >
                                    <DropdownMenuRadioItem value="bilateral">{t('planEditor.bilateral')}</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="unilateral_alternating">{t('planEditor.unilateralAlternating')}</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="unilateral_left">{t('planEditor.unilateralLeft')}</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="unilateral_right">{t('planEditor.unilateralRight')}</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>

                                <DropdownMenuCheckboxItem
                                    checked={exercise.weightUnit === 'kg'}
                                    onCheckedChange={(checked) => checked && updateExerciseInPlanDay(exercise, { weightUnit: 'kg' })}
                                >
                                    Kilograms (kg)
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={exercise.weightUnit === 'lbs'}
                                    onCheckedChange={(checked) => checked && updateExerciseInPlanDay(exercise, { weightUnit: 'lbs' })}
                                >
                                    Pounds (lbs)
                                </DropdownMenuCheckboxItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(dayId, exercise.$jazz.id, resolvedDetails?.name || 'unknown')}><Trash2 className="mr-2 size-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            {state.type === 'is-dragging-over' && state.closestEdge && <DropIndicator edge={state.closestEdge} gap="4px" />}
            {state.type === 'preview' && createPortal(<ExerciseDragPreview exercise={exercise} />, state.container)}
        </motion.div>
    );
};

function ExerciseDragPreview({ exercise }: { exercise: PlanExerciseResolved }) {
    const resolvedDetails = useResolvedExerciseDetails(exercise);
    return <Card className="p-3 shadow-lg"><div className="flex items-center justify-between gap-4"><p className="font-semibold">{resolvedDetails?.name}</p><span className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">{`${exercise.targetSets || '...'}x${exercise.targetReps || '...'}`}</span></div></Card>;
}

export default PlanEditor;