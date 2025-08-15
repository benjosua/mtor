import type { ExerciseWithRelations } from "@/jazz/db";
import { reorderSetsInSession } from "@/jazz/db";
import type { Progression } from "@/lib/progression";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { isSetData, type TSet as LocalTSet } from "../lib/types";
import { SetRow } from "./SetRow";

const containerVariants = { hidden: { opacity: 1 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 } };

export function SetList({ exercise, lastPerformance, progressionPlan, lastPerformanceBests }: {
    exercise: ExerciseWithRelations,
    lastPerformance: ExerciseWithRelations | null,
    progressionPlan: (Progression & { planUnit: 'kg' | 'lbs' }) | null,
    lastPerformanceBests: { best1rm: number; best10rm: number; }
}) {
    const [draggedId, setDraggedId] = useState<string | null>(null);

    useEffect(() => {
        return monitorForElements({
            canMonitor: ({ source }) => isSetData(source.data) && source.data.exerciseId === exercise.$jazz.id,
            onDragStart: ({ source }) => { if (isSetData(source.data)) setDraggedId(source.data.setId) },
            onDrop: ({ location, source }) => {
                setDraggedId(null);
                const target = location.current.dropTargets[0];
                if (!target) return;
                const sourceData = source.data;
                const targetData = target.data;
                const closestEdge = extractClosestEdge(targetData);
                if (!isSetData(sourceData) || !isSetData(targetData) || sourceData.exerciseId !== targetData.exerciseId || !closestEdge || (closestEdge !== 'top' && closestEdge !== 'bottom')) return;
                reorderSetsInSession(exercise, sourceData.setId, targetData.setId, closestEdge);
            },
        });
    }, [exercise]);

    return (
        <div>
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                    {(exercise.sets || []).map((set, index) => set && (
                        <motion.div
                            key={set.$jazz.id}
                            variants={itemVariants}
                            layout
                            style={{ zIndex: set.$jazz.id === draggedId ? 1 : 0, position: "relative" }}
                        >
                            <SetRow
                                set={set}
                                exercise={exercise}
                                lastSetData={lastPerformance?.sets?.[index] as LocalTSet | undefined}
                                progressionTarget={progressionPlan?.nextWorkoutPlan[index]}
                                progressionPlanUnit={progressionPlan?.planUnit}
                                lastPerformanceBests={lastPerformanceBests}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}