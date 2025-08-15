import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ExerciseWithRelations, SessionWithRelations } from "@/jazz/db";
import { addExerciseToSession, reorderExercisesInSession, swapExerciseInSession } from "@/jazz/db";
import { getExerciseData, isExerciseData } from "@/lib/types";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { DropIndicator } from "./drop-indicator";
import { Exercise } from "./Exercise";
import { ExerciseSearch } from "./ExerciseSearch";
import { useResolvedExerciseDetails } from "@/hooks/useResolvedExercise";

type DraggableState = { type: 'idle' } | { type: 'is-dragging' } | { type: 'is-dragging-over', closestEdge: Edge | null };
const idle: DraggableState = { type: 'idle' };

const getInitials = (name: string) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(word => word[0])
        .filter(Boolean)
        .slice(0, 3)
        .join('')
        .toUpperCase();
};

const DraggableTabTrigger = ({ exercise }: { exercise: ExerciseWithRelations }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<DraggableState>(idle);
    const resolvedDetails = useResolvedExerciseDetails(exercise);

    useEffect(() => {
        const element = ref.current;
        invariant(element);
        return combine(
            draggable({
                element,
                getInitialData: () => getExerciseData(exercise),
                onDragStart: () => setState({ type: 'is-dragging' }),
                onDrop: () => setState(idle)
            }),
            dropTargetForElements({
                element,
                canDrop: ({ source }) => isExerciseData(source.data) && source.data.exerciseId !== exercise.$jazz.id,
                getData: ({ input }) => attachClosestEdge(getExerciseData(exercise), { element, input, allowedEdges: ['left', 'right'] }),
                onDragEnter: ({ self }) => setState({ type: 'is-dragging-over', closestEdge: extractClosestEdge(self.data) }),
                onDrag: ({ self }) => { const closestEdge = extractClosestEdge(self.data); setState((current) => current.type === "is-dragging-over" && current.closestEdge === closestEdge ? current : { type: "is-dragging-over", closestEdge }); },
                onDragLeave: () => setState(idle),
                onDrop: () => setState(idle)
            })
        );
    }, [exercise]);

    return (
        <div ref={ref} className="relative flex">
            <TabsTrigger
                value={exercise.$jazz.id}
                className={clsx('relative cursor-grab data-[state=active]:z-10', { 'opacity-40': state.type === 'is-dragging' })}
            >
                {getInitials(resolvedDetails?.name || 'Exercise')}
            </TabsTrigger>
            {state.type === 'is-dragging-over' && state.closestEdge && <DropIndicator edge={state.closestEdge} gap={"0px"} />}
        </div>
    );
};

export function ExerciseList({ session }: { session: SessionWithRelations }) {
    const [activeTab, setActiveTab] = useState<string | undefined>(
        session.exercises.length > 0 ? session.exercises[0]?.$jazz.id : undefined
    );
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [exerciseToSwap, setExerciseToSwap] = useState<ExerciseWithRelations | null>(null);
    const [lastAutoSwitch, setLastAutoSwitch] = useState<string | null>(null);
    const userManuallyChangedTab = useRef(false);

    useEffect(() => {
        if (session.exercises && session.exercises.length > 0) {
            const currentTabExists = session.exercises.some(ex => ex?.$jazz.id === activeTab);
            if (!activeTab || !currentTabExists) {
                setActiveTab(session.exercises[0]?.$jazz.id);
            }
        } else {
            setActiveTab(undefined);
        }
    }, [session.exercises, activeTab]);

    useEffect(() => {
        if (session.completedAt) {
            return;
        }

        if (userManuallyChangedTab.current) {
            userManuallyChangedTab.current = false;
            return;
        }

        const currentActiveExercise = session.exercises.find(ex => ex?.$jazz.id === activeTab);

        if (currentActiveExercise) {
            const hasIncompleteSets = currentActiveExercise.sets.some(set => set && set.status === 'todo');

            if (!hasIncompleteSets) {
                const nextExercise = session.exercises.find(exercise =>
                    exercise.sets.some(set => set && set.status === 'todo')
                );

                if (nextExercise && nextExercise.$jazz.id !== activeTab && nextExercise.$jazz.id !== lastAutoSwitch) {
                    const timer = setTimeout(() => {
                        setActiveTab(nextExercise.$jazz.id);
                        setLastAutoSwitch(nextExercise.$jazz.id);
                    }, 300);
                    return () => clearTimeout(timer);
                }
            }
        } else {
            const firstIncomplete = session.exercises.find(exercise =>
                exercise.sets.some(set => set && set.status === 'todo')
            );

            if (firstIncomplete && firstIncomplete.$jazz.id !== lastAutoSwitch) {
                const timer = setTimeout(() => {
                    setActiveTab(firstIncomplete.$jazz.id);
                    setLastAutoSwitch(firstIncomplete.$jazz.id);
                }, 300);
                return () => clearTimeout(timer);
            }
        }
    }, [session.exercises, session.completedAt, activeTab, lastAutoSwitch]);

    const handleTabChange = (value: string) => {
        userManuallyChangedTab.current = true;
        setActiveTab(value);
    };

    useEffect(() => {
        return monitorForElements({
            canMonitor({ source }) { return isExerciseData(source.data) },
            onDrop({ location, source }) {
                const target = location.current.dropTargets[0];
                if (!target) return;
                const sourceData = source.data;
                const targetData = target.data;
                const closestEdge = extractClosestEdge(targetData);
                if (!isExerciseData(sourceData) || !isExerciseData(targetData) || !closestEdge) return;

                if (closestEdge === 'left' || closestEdge === 'right') {
                    const reorderEdge = closestEdge === 'left' ? 'top' : 'bottom';
                    reorderExercisesInSession(session, sourceData.exerciseId, targetData.exerciseId, reorderEdge);
                }
            },
        })
    }, [session]);

    const handleInitiateSwap = (exercise: ExerciseWithRelations) => {
        setExerciseToSwap(exercise);
        setIsSearchOpen(true);
    };

    const handleSelectExercise = async (exerciseId: string) => {
        if (exerciseToSwap) {
            await swapExerciseInSession(session, exerciseToSwap.$jazz.id, exerciseId);
        } else {
            await addExerciseToSession(session, exerciseId);
            const newExercise = session.exercises[session.exercises.length - 1];
            if (newExercise) {
                setActiveTab(newExercise.$jazz.id);
            }
        }
        setIsSearchOpen(false);
        setExerciseToSwap(null);
    }

    const handleCloseSearch = () => {
        setIsSearchOpen(false);
        setExerciseToSwap(null);
    };

    return (
        <div>
            <Tabs value={activeTab} onValueChange={handleTabChange} >
                <TabsList className="h-auto p-1">
                    <AnimatePresence>
                        {session.exercises.map((exercise) => (
                            <motion.div
                                key={exercise.$jazz.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                            >
                                <DraggableTabTrigger exercise={exercise} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {session.exercises.length === 0 && (
                        <span className="self-center text-primary text-sm mr-1 pl-3">Add your first exercise</span>
                    )}
                    <Button
                        variant="ghost"
                        onClick={() => setIsSearchOpen(true)}
                        className="h-full px-3 self-center ml-1 text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="size-4" />
                    </Button>
                </TabsList>

                <div className="mt-4">
                    <AnimatePresence mode="wait">
                        {session.exercises.map((exercise) =>
                            activeTab === exercise.$jazz.id ? (
                                <TabsContent key={exercise.$jazz.id} value={exercise.$jazz.id} asChild forceMount>
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Exercise exercise={exercise} session={session} onInitiateSwap={handleInitiateSwap} />
                                    </motion.div>
                                </TabsContent>
                            ) : null
                        )}
                    </AnimatePresence>
                </div>
            </Tabs>

            <ExerciseSearch
                isOpen={isSearchOpen}
                onClose={handleCloseSearch}
                onSelectExercise={handleSelectExercise}
                exerciseToSwap={exerciseToSwap ?? undefined}
            />
        </div>
    );
}