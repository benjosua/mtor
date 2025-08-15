import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExerciseWithRelations, SetResolved } from "@/jazz/db";
import { startRestTimer, updateSet, useSettings } from "@/jazz/db";
import { calculateEpley1RM, getWeightForReps } from "@/lib/analysis";
import { convertDisplayToKg, convertKgToDisplay } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import clsx from "clsx";
import { CheckSquare, ClipboardClock, Clock, Ruler, Target, Weight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import invariant from "tiny-invariant";
import { ExerciseType, getSetData, isSetData, type TSet as LocalTSet } from "../lib/types";
import { DropIndicator } from "./drop-indicator";

type SetState = { type: "idle" } | { type: "preview"; container: HTMLElement } | { type: "is-dragging" } | { type: "is-dragging-over"; closestEdge: Edge | null };
const idle: SetState = { type: "idle" };

const InlineInput = ({ value, onChange, onSave, onCancel, placeholder = "-", suffix = "", label = "", type = "number", inputMode = "decimal" as const, className = "" }: { value: string; onChange: (value: string) => void; onSave: () => void; onCancel: () => void; placeholder?: string; suffix?: string; label?: string; type?: string; inputMode?: "decimal" | "numeric"; className?: string; }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, []);
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onSave(); else if (e.key === 'Escape') onCancel(); };
    const width = Math.max((value || placeholder).length * 0.6 + 1, 2);
    return (
        <div className={clsx("flex flex-col items-center relative", className)}>
            <input ref={inputRef} type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} onBlur={onSave} placeholder={placeholder} className="h-auto px-0 py-0 text-center text-lg font-semibold leading-tight bg-transparent border-none outline-none focus:outline-none focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ appearance: 'textfield', MozAppearance: 'textfield', WebkitAppearance: 'none', width: `${width}ch` }} />
            {suffix && (<span className="text-xs text-muted-foreground">{suffix}</span>)}
            {label && (<span className="text-xs text-muted-foreground">{label}</span>)}
        </div>
    );
};

export function SetRow({ set, exercise, lastSetData, progressionTarget, progressionPlanUnit, lastPerformanceBests }: { set: SetResolved; exercise: ExerciseWithRelations; lastSetData?: LocalTSet; progressionTarget?: { weight: number; reps: number; rir?: number; }; progressionPlanUnit?: 'kg' | 'lbs'; lastPerformanceBests: { best1rm: number; best10rm: number } }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [state, setState] = useState<SetState>(idle);
    // const { confirm } = useDialog();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const displayUnit = useMemo(() => exercise.weightUnit ?? settings?.weightUnit ?? 'kg', [exercise.weightUnit, settings?.weightUnit]);
    const [editingField, setEditingField] = useState<'weight' | 'reps' | 'rir' | null>(null);
    const [localWeight, setLocalWeight] = useState(String(convertKgToDisplay(set.weight, displayUnit) || ''));
    const [localReps, setLocalReps] = useState(String(set.reps ?? ''));
    const [localRir, setLocalRir] = useState(String(set.rir ?? ''));

    const isRirEnabled = exercise.trackingOverrides?.rir ?? settings?.trackingSettings?.rir ?? false;
    const is1rmEnabled = exercise.trackingOverrides?.['1rm'] ?? settings?.trackingSettings?.['1rm'] ?? false;
    const is10rmEnabled = exercise.trackingOverrides?.['10rm'] ?? settings?.trackingSettings?.['10rm'] ?? false;
    const showHistoryBadges = settings?.trackingSettings?.showHistoryBadges ?? true;

    const estimations = useMemo(() => {
        const { weight, reps, rir } = set;
        if (exercise.type !== ExerciseType.Sets || typeof weight !== "number" || typeof reps !== "number") return { e1rm: null, e10rm: null };
        const e1rm = calculateEpley1RM(weight, reps, rir ?? 0);
        if (e1rm <= 0) return { e1rm: null, e10rm: null };
        const e10rm = getWeightForReps(e1rm, 10);
        return { e1rm: e1rm.toFixed(1), e10rm: e10rm.toFixed(1) };
    }, [set.weight, set.reps, set.rir, exercise.type]);

    const formattedTargetWeight = useMemo(() => {
        if (!progressionTarget || !progressionPlanUnit) return '';
        if (progressionPlanUnit === displayUnit) return progressionTarget.weight.toFixed(1).replace(/\.0$/, '');
        const weightInKg = progressionPlanUnit === 'lbs' ? convertDisplayToKg(progressionTarget.weight, 'lbs') : progressionTarget.weight;
        return convertKgToDisplay(weightInKg, displayUnit).toFixed(1).replace(/\.0$/, '');
    }, [progressionTarget, progressionPlanUnit, displayUnit]);

    useEffect(() => {
        if (!editingField) {
            setLocalWeight(String(convertKgToDisplay(set.weight, displayUnit) || ''));
            setLocalReps(String(set.reps ?? ''));
            setLocalRir(String(set.rir ?? ''));
        }
    }, [set.weight, set.reps, set.rir, editingField, displayUnit]);

    useEffect(() => {
        const element = ref.current;
        invariant(element);
        return combine(
            draggable({ element, getInitialData: () => getSetData(set, exercise.$jazz.id), onGenerateDragPreview({ nativeSetDragImage }) { setCustomNativeDragPreview({ nativeSetDragImage, getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }), render: ({ container }) => setState({ type: "preview", container }) }); }, onDragStart: () => setState({ type: "is-dragging" }), onDrop: () => setState(idle) }),
            dropTargetForElements({ element, canDrop: ({ source }) => isSetData(source.data) && source.data.exerciseId === exercise.$jazz.id && source.element !== element, getData: ({ input }) => attachClosestEdge(getSetData(set, exercise.$jazz.id), { element, input, allowedEdges: ["top", "bottom"] }), getIsSticky: () => true, onDragEnter: ({ self }) => setState({ type: "is-dragging-over", closestEdge: extractClosestEdge(self.data) }), onDrag: ({ self }) => { const closestEdge = extractClosestEdge(self.data); setState((current) => current.type === "is-dragging-over" && current.closestEdge === closestEdge ? current : { type: "is-dragging-over", closestEdge }); }, onDragLeave: () => setState(idle), onDrop: () => setState(idle) }),
        );
    }, [set, exercise.$jazz.id]);

    const handleUpdate = (updates: Partial<SetResolved>) => {
        updateSet(set, updates);
        if (updates.status === "completed") {
            startRestTimer(exercise.restBetweenSets ?? settings?.globalRestTimer ?? 90);
        } else if (updates.status === "todo") {
        }
    };

    const handleCycleSide = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        let newSide: 'left' | 'right' | undefined;
        if (!set.side) {
            newSide = 'left';
        } else if (set.side === 'left') {
            newSide = 'right';
        } else {
            newSide = undefined;
        }
        console.log('Cycling side from', set.side, 'to', newSide);
        set.$jazz.set("side", newSide);
    };

    const handleFieldSave = (field: 'weight' | 'reps' | 'rir') => {
        if (field === 'weight') {
            const newWeightInKg = isNaN(parseFloat(localWeight)) ? undefined : convertDisplayToKg(parseFloat(localWeight), displayUnit);
            if (newWeightInKg !== set.weight) {
                set.$jazz.set("weight", newWeightInKg);
            }
        } else if (field === 'reps') {
            const newReps = isNaN(parseInt(localReps, 10)) ? undefined : parseInt(localReps, 10);
            if (newReps !== set.reps) {
                set.$jazz.set("reps", newReps);
            }
        } else if (field === 'rir') {
            const newRir = isNaN(parseInt(localRir, 10)) ? undefined : parseInt(localRir, 10);
            if (newRir !== set.rir) {
                set.$jazz.set("rir", newRir);
            }
        }
        setEditingField(null);
    };

    let lastSetDataDisplay: React.ReactNode = null;
    if (lastSetData) {
        if (lastSetData.status !== "completed") lastSetDataDisplay = t('common.skipped');
        else {
            const lastWeightDisplay = convertKgToDisplay(lastSetData.weight, displayUnit);
            const sideIndicator = lastSetData.side ? ` (${lastSetData.side.charAt(0).toUpperCase()})` : "";
            lastSetDataDisplay = `${lastWeightDisplay || "-"} ${displayUnit} × ${lastSetData.reps ?? "-"}${sideIndicator}${lastSetData.rir != null ? ` @ ${lastSetData.rir}RIR` : ""}`;
        }
    }

    const renderSetInputs = () => {
        switch (exercise.type) {
            case ExerciseType.Sets:
                return (
                    <Button variant="outline" className="h-auto justify-center gap-2 px-3 py-1.5 font-normal">
                        <div className="flex flex-col items-center" onClick={() => setEditingField('weight')}>
                            {editingField === 'weight' ? (
                                <InlineInput
                                    value={localWeight}
                                    onChange={setLocalWeight}
                                    onSave={() => handleFieldSave('weight')}
                                    onCancel={() => {
                                        setLocalWeight(String(convertKgToDisplay(set.weight, displayUnit) || ''));
                                        setEditingField(null);
                                    }}
                                    suffix={displayUnit}
                                    inputMode="decimal"
                                />
                            ) : (
                                <>
                                    <span className="text-lg font-semibold leading-tight">{convertKgToDisplay(set.weight, displayUnit) || "-"}</span>
                                    <span className="text-xs text-muted-foreground">{displayUnit}</span>
                                </>
                            )}
                        </div>
                        <X size={16} className="shrink-0 text-muted-foreground" />
                        <div className="flex flex-col items-center" onClick={() => setEditingField('reps')}>
                            {editingField === 'reps' ? (
                                <InlineInput
                                    value={localReps}
                                    onChange={setLocalReps}
                                    onSave={() => handleFieldSave('reps')}
                                    onCancel={() => {
                                        setLocalReps(String(set.reps ?? ''));
                                        setEditingField(null);
                                    }}
                                    label={t('common.reps')}
                                    inputMode="numeric"
                                />
                            ) : (
                                <>
                                    <span className="text-lg font-semibold leading-tight">{set.reps ?? "-"}</span>
                                    <span className="text-xs text-muted-foreground">{t('common.reps')}</span>
                                </>
                            )}
                        </div>
                        {isRirEnabled && (
                            <>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center cursor-help" onClick={(e) => { e.preventDefault(); setEditingField('rir'); }}>
                                                {editingField === 'rir' ? (
                                                    <InlineInput
                                                        value={localRir}
                                                        onChange={setLocalRir}
                                                        onSave={() => handleFieldSave('rir')}
                                                        onCancel={() => {
                                                            setLocalRir(String(set.rir ?? ''));
                                                            setEditingField(null);
                                                        }}
                                                        label={t('common.rir')}
                                                        inputMode="numeric"
                                                    />
                                                ) : (
                                                    <>
                                                        <span className="text-lg font-semibold leading-tight">{set.rir ?? "-"}</span>
                                                        <span className="text-xs text-muted-foreground">{t('common.rir')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('setRow.rirHint')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </>
                        )}
                        {is1rmEnabled && estimations.e1rm && (
                            <>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center cursor-help">
                                                <span className="text-lg font-semibold leading-tight">{convertKgToDisplay(parseFloat(estimations.e1rm), displayUnit).toFixed(1)}</span>
                                                <span className="text-xs text-muted-foreground">{t('common.e1rm')}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('setRow.e1rmHint')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </>
                        )}
                        {is10rmEnabled && estimations.e10rm && (
                            <>
                                <div className="mx-1 h-6 w-px bg-border" />
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center cursor-help">
                                                <span className="text-lg font-semibold leading-tight">{convertKgToDisplay(parseFloat(estimations.e10rm), displayUnit).toFixed(1)}</span>
                                                <span className="text-xs text-muted-foreground">{t('common.e10rm')}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('setRow.e10rmHint')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </>
                        )}
                    </Button>
                );
            case ExerciseType.TimeIntervals:
            case ExerciseType.Duration:
                return (
                    <Input
                        type="number"
                        value={set.duration ?? ""}
                        onChange={(e) => handleUpdate({ duration: parseInt(e.target.value, 10) || undefined })}
                        className="w-full max-w-[120px]"
                        placeholder={t('setRow.durationPlaceholder')}
                    />
                );
            case ExerciseType.Distance:
                return (
                    <>
                        <Input
                            type="number"
                            value={set.distance ?? ""}
                            onChange={(e) => handleUpdate({ distance: parseFloat(e.target.value) || undefined })}
                            className="w-full max-w-[120px]"
                            placeholder={t('setRow.distancePlaceholder')}
                        />
                        <Input
                            type="number"
                            value={set.duration ?? ""}
                            onChange={(e) => handleUpdate({ duration: parseInt(e.target.value, 10) || undefined })}
                            className="w-full max-w-[120px]"
                            placeholder={t('setRow.durationPlaceholder')}
                        />
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div className="relative">
                <div ref={ref} className={clsx("mx-auto my-1 flex flex-col gap-2 py-1", { "opacity-40": state.type === "is-dragging" })}>
                    <div className="flex w-full items-center justify-between gap-2">
                        <div className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors", set.status === "completed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{set.order + 1}</div>
                        <div className={clsx("flex flex-col grow items-center justify-center gap-1.5 transition-all", { "grayscale opacity-75 brightness-90": state.type !== "is-dragging" && set.status === "completed" })}>
                            {renderSetInputs()}
                        </div>
                        <Checkbox checked={set.status === "completed"} onCheckedChange={(checked: boolean) => handleUpdate({ status: checked ? "completed" : "todo" })} className="size-6" />
                    </div>

                    <div className="pl-8 pr-12 flex flex-wrap items-center justify-center gap-2">
                        <div
                            onClick={handleCycleSide}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                            className="inline-flex items-center gap-x-1.5 rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
                            style={{ touchAction: 'none' }}
                        >
                            <span className="font-medium text-foreground/90">
                                {set.side === 'left' ? t('setRow.left') : set.side === 'right' ? t('setRow.right') : t('setRow.bilateral')}
                            </span>
                        </div>
                        {showHistoryBadges && lastSetDataDisplay && (<div className="inline-flex items-center gap-x-1.5 rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs text-muted-foreground"><ClipboardClock className="size-3 shrink-0" /><span className="font-medium text-foreground/90">{lastSetDataDisplay}</span></div>)}
                        {showHistoryBadges && is1rmEnabled && lastPerformanceBests.best1rm > 0 && (
                            <div className="inline-flex items-center gap-x-1.5 rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                <ClipboardClock className="size-3 shrink-0" />
                                <span className="font-medium text-foreground/90">
                                    {t('setRow.last1rm')} {convertKgToDisplay(lastPerformanceBests.best1rm, displayUnit).toFixed(1)}{displayUnit}
                                </span>
                            </div>
                        )}
                        {showHistoryBadges && is10rmEnabled && lastPerformanceBests.best10rm > 0 && (
                            <div className="inline-flex items-center gap-x-1.5 rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                <ClipboardClock className="size-3 shrink-0" />
                                <span className="font-medium text-foreground/90">
                                    {t('setRow.last10rm')} {convertKgToDisplay(lastPerformanceBests.best10rm, displayUnit).toFixed(1)}{displayUnit}
                                </span>
                            </div>
                        )}
                        {progressionTarget && (
                            <div className="inline-flex items-center gap-x-1.5 rounded-md bg-muted/70 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                <Target className="size-3 shrink-0" />
                                <span className="font-medium text-foreground/90">
                                    {t('setRow.target')} {formattedTargetWeight}{displayUnit} &times; {progressionTarget.reps}
                                    {progressionTarget.rir !== undefined && ` @ ${progressionTarget.rir} RIR`}
                                </span>
                            </div>
                        )}
                    </div>

                </div>
                {state.type === "is-dragging-over" && state.closestEdge && <DropIndicator edge={state.closestEdge} gap={"8px"} />}
            </div>
            {state.type === "preview" && createPortal(<DragPreview set={set} exerciseType={exercise.type} />, state.container)}
        </>
    );
}

function DragPreview({ set, exerciseType }: { set: SetResolved; exerciseType: ExerciseType | string; }) {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const displayUnit = settings?.weightUnit ?? 'kg';
    const sideIndicator = set.side ? ` (${set.side.charAt(0).toUpperCase()})` : "";
    const renderPreviewContent = () => {
        switch (exerciseType) {
            case ExerciseType.Sets: return <IconWithText icon={Weight} text={`${set.reps ?? 0} reps, ${convertKgToDisplay(set.weight, displayUnit) || 0} ${displayUnit}${sideIndicator}`} />;
            case ExerciseType.TimeIntervals: case ExerciseType.Duration: return <IconWithText icon={Clock} text={`${set.duration ?? 0} sec`} />;
            case ExerciseType.Distance: return <IconWithText icon={Ruler} text={`${set.distance ?? 0} m, ${set.duration ?? 0} sec`} />;
            case ExerciseType.CheckOff: return <IconWithText icon={CheckSquare} text={set.status === "completed" ? t('setRow.completed') : t('setRow.incomplete')} />;
            default: return <IconWithText icon={Weight} text={t('setRow.set')} />;
        }
    };
    return <Card><CardContent className="p-2">{renderPreviewContent()}</CardContent></Card>;
}

const IconWithText = ({ icon: Icon, text }: { icon: React.ElementType; text: string; }) => (
    <div className="flex items-center space-x-2"><Icon className="size-5 text-secondary-foreground" /><span className="text-sm font-medium">{text}</span></div>
);