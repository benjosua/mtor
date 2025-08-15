import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    WheelPicker,
    WheelPickerWrapper,
    type WheelPickerOption,
} from "@/components/wheel-picker";

interface RepsWeightInputProps {
    children: React.ReactNode;
    onSave: (data: { weight: number; reps: number; rir?: number }) => void;
    initialWeight?: number;
    initialReps?: number;
    initialRir?: number;
    isRirEnabled: boolean;
}

const generateOptions = (
    start: number,
    end: number,
    step: number,
    suffix: string,
): WheelPickerOption[] => {
    const options: WheelPickerOption[] = [];
    const precision = step.toString().split(".")[1]?.length || 0;
    for (
        let i = start;
        i <= end;
        i = parseFloat((i + step).toFixed(precision))
    ) {
        const value = i.toFixed(precision);
        options.push({ label: `${value} ${suffix}`, value: value });
    }
    return options;
};

const findClosestValue = (
    options: WheelPickerOption[],
    target: number,
): string => {
    if (options.length === 0) return "0";
    return options.reduce((prev, curr) => {
        const prevDiff = Math.abs(parseFloat(prev.value) - target);
        const currDiff = Math.abs(parseFloat(curr.value) - target);
        return currDiff < prevDiff ? curr : prev;
    }).value;
};

export function RepsWeightInput({
    children,
    onSave,
    initialWeight = 0,
    initialReps = 10,
    initialRir = 0,
    isRirEnabled,
}: RepsWeightInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localWeight, setLocalWeight] = useState(initialWeight.toString());
    const [localReps, setLocalReps] = useState(initialReps.toString());
    const [localRir, setLocalRir] = useState(initialRir.toString());
    const [_activeTab, setActiveTab] = useState<'picker' | 'manual'>('picker');

    const weightOptions = useMemo(() => generateOptions(0, 300, 1.25, "kg"), []);
    const repsOptions = useMemo(() => generateOptions(1, 100, 1, "reps"), []);
    const rirOptions = useMemo(
        () =>
            Array.from({ length: 11 }, (_, i) => ({ label: `${i} RIR`, value: `${i}` })),
        [],
    );

    const dynamicWeightOptions = useMemo(() => {
        const parsedWeight = parseFloat(localWeight);
        if (isNaN(parsedWeight) || weightOptions.some(opt => parseFloat(opt.value) === parsedWeight)) {
            return weightOptions;
        }
        const newOption = {
            value: parsedWeight.toFixed(2),
            label: `${parsedWeight.toFixed(2)} kg`,
        };
        const combined = [...weightOptions, newOption];
        return combined.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
    }, [localWeight, weightOptions]);

    const dynamicRepsOptions = useMemo(() => {
        const parsedReps = parseInt(localReps, 10);
        if (isNaN(parsedReps) || repsOptions.some(opt => parseInt(opt.value, 10) === parsedReps)) {
            return repsOptions;
        }
        const newOption = {
            value: parsedReps.toString(),
            label: `${parsedReps} reps`,
        };
        const combined = [...repsOptions, newOption];
        return combined.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
    }, [localReps, repsOptions]);

    const dynamicRirOptions = useMemo(() => {
        if (!isRirEnabled) return rirOptions;
        const parsedRir = parseInt(localRir, 10);
        if (isNaN(parsedRir) || rirOptions.some(opt => parseInt(opt.value, 10) === parsedRir)) {
            return rirOptions;
        }
        const newOption = {
            value: parsedRir.toString(),
            label: `${parsedRir} RIR`,
        };
        const combined = [...rirOptions, newOption];
        return combined.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
    }, [localRir, rirOptions, isRirEnabled]);

    useEffect(() => {
        if (isOpen) {
            setLocalWeight(findClosestValue(weightOptions, initialWeight));
            setLocalReps(findClosestValue(repsOptions, initialReps));
            if (isRirEnabled) {
                setLocalRir(findClosestValue(rirOptions, initialRir));
            }
        }
    }, [
        isOpen,
        initialWeight,
        initialReps,
        initialRir,
        isRirEnabled,
        weightOptions,
        repsOptions,
        rirOptions,
    ]);

    const handleSave = () => {
        onSave({
            weight: parseFloat(localWeight) || 0,
            reps: parseInt(localReps, 10) || 0,
            rir: isRirEnabled ? parseInt(localRir, 10) : undefined,
        });
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
                                options={dynamicWeightOptions}
                                value={localWeight}
                                onValueChange={setLocalWeight}
                            />
                            <WheelPicker
                                options={dynamicRepsOptions}
                                value={localReps}
                                onValueChange={setLocalReps}
                            />
                            {isRirEnabled && (
                                <WheelPicker
                                    options={dynamicRirOptions}
                                    value={localRir}
                                    onValueChange={setLocalRir}
                                />
                            )}
                        </WheelPickerWrapper>
                    </TabsContent>
                    <TabsContent value="manual" className="pt-4">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="weight" className="text-right">
                                    Weight
                                </Label>
                                <div className="relative col-span-2">
                                    <Input
                                        id="weight"
                                        type="number"
                                        inputMode="decimal"
                                        value={localWeight}
                                        onChange={(e) => setLocalWeight(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                        kg
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="reps" className="text-right">
                                    Reps
                                </Label>
                                <Input
                                    id="reps"
                                    type="number"
                                    inputMode="numeric"
                                    value={localReps}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setLocalReps(e.target.value)}
                                    className="col-span-2"
                                />
                            </div>
                            {isRirEnabled && (
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="rir" className="text-right">
                                        RIR
                                    </Label>
                                    <Input
                                        id="rir"
                                        type="number"
                                        inputMode="numeric"
                                        value={localRir}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => setLocalRir(e.target.value)}
                                        className="col-span-2"
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}