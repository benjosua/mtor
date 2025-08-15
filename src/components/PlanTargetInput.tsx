import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@/components/wheel-picker";
import { useEffect, useMemo, useState } from "react";

interface PlanTargetInputProps {
    children: React.ReactNode;
    onSave: (data: { sets?: number; reps?: number; rir?: number }) => void;
    initialSets?: number;
    initialReps?: number;
    initialRir?: number;
    showRir?: boolean;
}

const generateNumericOptions = (start: number, end: number, step: number, suffix: string): WheelPickerOption[] => {
    const options: WheelPickerOption[] = [];
    for (let i = start; i <= end; i += step) {
        const value = i.toString();
        options.push({ label: `${value} ${suffix}`, value });
    }
    return options;
};

const findClosestValue = (options: WheelPickerOption[], target: number): string => {
    if (options.length === 0) return "0";
    return options.reduce((prev, curr) => {
        const prevDiff = Math.abs(parseInt(prev.value, 10) - target);
        const currDiff = Math.abs(parseInt(curr.value, 10) - target);
        return currDiff < prevDiff ? curr : prev;
    }).value;
};

const parseRepsForPicker = (reps: number | undefined): number => {
    return reps ?? 10;
};

export function PlanTargetInput({
    children,
    onSave,
    initialSets = 3,
    initialReps = 10,
    initialRir = 2,
    showRir = false,
}: PlanTargetInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localSets, setLocalSets] = useState(initialSets.toString());
    const [localReps, setLocalReps] = useState(initialReps.toString());
    const [localRir, setLocalRir] = useState(initialRir.toString());
    const [_activeTab, setActiveTab] = useState<'picker' | 'manual'>('picker');

    const setsOptions = useMemo(() => generateNumericOptions(1, 20, 1, "sets"), []);
    const repsOptions = useMemo(() => generateNumericOptions(1, 50, 1, "reps"), []);
    const rirOptions = useMemo(() => generateNumericOptions(0, 10, 1, "RIR"), []);

    useEffect(() => {
        if (isOpen) {
            setLocalSets(findClosestValue(setsOptions, initialSets));
            const repsForPicker = parseRepsForPicker(initialReps);
            setLocalReps(findClosestValue(repsOptions, repsForPicker));
            if (showRir) {
                setLocalRir(findClosestValue(rirOptions, initialRir));
            }
        }
    }, [isOpen, initialSets, initialReps, initialRir, showRir, setsOptions, repsOptions, rirOptions]);

    const handleSave = () => {
        const data: { sets?: number, reps?: number, rir?: number } = {
            sets: localSets ? parseInt(localSets, 10) : undefined,
            reps: localReps ? parseInt(localReps, 10) : undefined,
        };
        if (showRir) {
            data.rir = localRir ? parseInt(localRir, 10) : undefined;
        }
        onSave(data);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open && isOpen) {
            handleSave();
        }
        setIsOpen(open);
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80">

                <Tabs defaultValue="picker" className="w-full" onValueChange={(value) => setActiveTab(value as 'picker' | 'manual')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="picker">Picker</TabsTrigger>
                        <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="picker" className="pt-4">
                        <WheelPickerWrapper className="flex w-full">
                            <WheelPicker
                                options={setsOptions}
                                value={localSets}
                                onValueChange={setLocalSets}
                            />
                            <WheelPicker
                                options={repsOptions}
                                value={localReps}
                                onValueChange={setLocalReps}
                            />
                            {showRir && (
                                <WheelPicker options={rirOptions} value={localRir} onValueChange={setLocalRir} />
                            )}
                        </WheelPickerWrapper>
                    </TabsContent>
                    <TabsContent value="manual" className="pt-4">
                        <div className={`grid gap-2 ${showRir ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            <div className="space-y-1">
                                <Label htmlFor="sets-manual">Sets</Label>
                                <Input
                                    id="sets-manual"
                                    type="number"
                                    value={localSets}
                                    onChange={(e) => setLocalSets(e.target.value)}
                                    placeholder="e.g. 3"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="reps-manual">Reps</Label>
                                <Input
                                    id="reps-manual"
                                    type="number"
                                    value={localReps}
                                    onChange={(e) => setLocalReps(e.target.value)}
                                    placeholder="e.g. 10"
                                    className="h-9"
                                />
                            </div>
                            {showRir && (
                                <div className="space-y-1">
                                    <Label htmlFor="rir-manual">RIR</Label>
                                    <Input
                                        id="rir-manual"
                                        type="number"
                                        value={localRir}
                                        onChange={(e) => setLocalRir(e.target.value)}
                                        placeholder="e.g. 2"
                                        className="h-9"
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover >
    );
}