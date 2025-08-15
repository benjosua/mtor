import { useEffect, useState } from "react";

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

interface SingleValuePickerInputProps {
    children: React.ReactNode;
    onSave: (value: string) => void;
    options: WheelPickerOption[];
    initialValue?: string | number;
    label: string;
    suffix?: string;
}

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

export function SingleValuePickerInput({
    children,
    onSave,
    options,
    initialValue = 0,
    label,
    suffix,
}: SingleValuePickerInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localValue, setLocalValue] = useState(initialValue.toString());

    useEffect(() => {
        if (isOpen) {
            setLocalValue(findClosestValue(options, Number(initialValue)));
        }
    }, [isOpen, initialValue, options]);

    const handleOpenChange = (open: boolean) => {
        if (!open && isOpen) { 
            onSave(localValue);
        }
        setIsOpen(open);
    };

    const snapToStep = () => {
        const target = parseFloat(localValue) || 0;
        setLocalValue(findClosestValue(options, target));
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-64">
                <Tabs defaultValue="picker" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="picker">Picker</TabsTrigger>
                        <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="picker" className="pt-4">
                        <WheelPickerWrapper>
                            <WheelPicker
                                options={options}
                                value={localValue}
                                onValueChange={setLocalValue}
                            />
                        </WheelPickerWrapper>
                    </TabsContent>
                    <TabsContent value="manual" className="pt-4">
                        <div className="grid gap-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="value" className="text-right">
                                    {label}
                                </Label>
                                <div className="relative col-span-2">
                                    <Input
                                        id="value"
                                        type="number"
                                        value={localValue}
                                        onChange={(e) => setLocalValue(e.target.value)}
                                        onBlur={snapToStep}
                                        className={suffix ? "pr-8" : ""}
                                    />
                                    {suffix && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                            {suffix}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}