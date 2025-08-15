import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React, { createContext, useContext, useState } from "react";
import { useTranslation } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";
import { WeightPlateCalculator } from "./WeightPlateCalculator";

interface ConfirmOptions {
    title: string;
    description: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
}

interface PromptOptions {
    title: string;
    description?: string;
    onConfirm: (value: string) => void;
    defaultValue?: string;
    inputType?: React.HTMLInputTypeAttribute;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
}

interface PlateCalculatorOptions {
    weight?: number;
}

interface DialogContextType {
    confirm: (options: ConfirmOptions) => void;
    prompt: (options: PromptOptions) => void;
    openPlateCalculator: (options?: PlateCalculatorOptions) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
    const { t } = useTranslation();
    const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(
        null
    );
    const [promptState, setPromptState] = useState<PromptOptions | null>(null);
    const [promptValue, setPromptValue] = useState("");
    const [calculatorState, setCalculatorState] = useState<{
        weight?: number;
    } | null>(null);

    const confirm = (options: ConfirmOptions) => {
        setConfirmState(options);
    };

    const prompt = (options: PromptOptions) => {
        setPromptState(options);
        setPromptValue(options.defaultValue || "");
    };

    const openPlateCalculator = (options?: PlateCalculatorOptions) => {
        setCalculatorState({ weight: options?.weight });
    };

    const handleConfirmClose = () => {
        setConfirmState(null);
    };

    const handleConfirmAction = () => {
        if (confirmState) {
            confirmState.onConfirm();
        }
        handleConfirmClose();
    };

    const handlePromptClose = () => {
        setPromptState(null);
        setPromptValue("");
    };

    const handlePromptAction = () => {
        if (promptState) {
            promptState.onConfirm(promptValue);
        }
        handlePromptClose();
    };

    const handleCalculatorClose = () => {
        setCalculatorState(null);
    };

    return (
        <DialogContext.Provider value={{ confirm, prompt, openPlateCalculator }}>
            {children}

            <AlertDialog
                open={!!confirmState}
                onOpenChange={(isOpen) => !isOpen && handleConfirmClose()}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmState?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleConfirmClose}>
                            {confirmState?.cancelText || t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAction}>
                            {confirmState?.confirmText || t('common.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Prompt Dialog */}
            <Dialog
                open={!!promptState}
                onOpenChange={(isOpen) => !isOpen && handlePromptClose()}
            >
                <DialogContent
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handlePromptAction();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{promptState?.title}</DialogTitle>
                        {promptState?.description && (
                            <p className="text-sm text-muted-foreground">
                                {promptState.description}
                            </p>
                        )}
                    </DialogHeader>
                    <Input
                        value={promptValue}
                        onChange={(e) => setPromptValue(e.target.value)}
                        type={promptState?.inputType || "text"}
                        placeholder={promptState?.placeholder}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={handlePromptClose}>
                            {promptState?.cancelText || t('common.cancel')}
                        </Button>
                        <Button onClick={handlePromptAction}>
                            {promptState?.confirmText || t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Weight Plate Calculator */}
            <WeightPlateCalculator
                isOpen={!!calculatorState}
                onClose={handleCalculatorClose}
                initialWeight={calculatorState?.weight}
            />
        </DialogContext.Provider>
    );
};

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (context === undefined) {
        throw new Error("useDialog must be used within a DialogProvider");
    }
    return context;
};