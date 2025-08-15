import { useDialog } from "@/components/DialogProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { translations } from "@/data/master-library";
import {
    createCustomExercise,
    deleteCustomExercise,
    duplicateCustomExercise,
    toggleCustomExercisePublic, updateCustomExercise,
    useCustomExercises,
    type CustomExerciseResolved
} from "@/jazz/db";
import { cn } from "@/lib/utils";
import { Group } from "jazz-tools";
import { Asterisk, Check, Copy, Ellipsis, Plus, Share2, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from 'sonner';
import { useDebounceCallback } from 'usehooks-ts';

const EditableProperty = ({ value, options, placeholder, onSave }: { value: string; options: { value: string; label: string }[]; placeholder: string; onSave: (newValue: string) => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Badge variant={value ? "secondary" : "outline"} className="capitalize cursor-pointer transition-colors hover:border-primary">
                    {selectedLabel}
                </Badge>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[200px]" align="start">
                <Command>
                    <CommandInput placeholder={t('customExercises.filterPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map(option => (
                                <CommandItem key={option.value} value={option.label} onSelect={() => { onSave(option.value); setIsOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const CustomExerciseCard = ({ exercise }: { exercise: CustomExerciseResolved }) => {
    const { t } = useTranslation();
    const { confirm } = useDialog();
    const [localName, setLocalName] = useState(exercise.name);
    const [localNote, setLocalNote] = useState(exercise.notes ?? '');
    const [isAddMuscleOpen, setIsAddMuscleOpen] = useState(false);

    useEffect(() => { setLocalName(exercise.name) }, [exercise.name]);
    useEffect(() => { setLocalNote(exercise.notes ?? '') }, [exercise.notes]);

    const debouncedUpdateName = useDebounceCallback(
        (newName: string) => updateCustomExercise(exercise.$jazz.id, { name: newName }), 500
    );

    const debouncedUpdateNote = useDebounceCallback(
        (newNote: string) => updateCustomExercise(exercise.$jazz.id, { notes: newNote.trim() ? newNote : undefined }), 500
    );

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalName(e.target.value);
        debouncedUpdateName(e.target.value);
    };

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalNote(e.target.value);
        debouncedUpdateNote(e.target.value);
    };

    const handleUpdateProperty = (updates: Partial<Omit<CustomExerciseResolved, 'id' | 'name'>>) => {
        updateCustomExercise(exercise.$jazz.id, updates);
    };

    const handleAddSecondaryMuscle = (muscleValue: string) => {
        if (exercise.secondaryMuscleKeys && !exercise.secondaryMuscleKeys.includes(muscleValue)) {
            exercise.secondaryMuscleKeys.$jazz.push(muscleValue);
        }
        setIsAddMuscleOpen(false);
    };

    const handleRemoveSecondaryMuscle = (muscleValue: string) => {
        if (exercise.secondaryMuscleKeys) {
            const index = exercise.secondaryMuscleKeys.indexOf(muscleValue);
            if (index > -1) {
                exercise.secondaryMuscleKeys.$jazz.splice(index, 1);
            }
        }
    };

    const handleDelete = () => {
        confirm({
            title: t('customExercises.deleteExerciseTitle', { name: exercise.name }),
            description: t('customExercises.deleteExerciseDescription'),
            confirmText: t('common.delete'),
            onConfirm: () => {
                deleteCustomExercise(exercise.$jazz.id);
                toast.success(t('customExercises.exerciseDeleted', 'Exercise deleted.'));
            },
        });
    };

    const handleDuplicate = () => {
        duplicateCustomExercise(exercise.$jazz.id);
        toast.success(t('customExercises.exerciseDuplicated', 'Exercise duplicated.'));
    };

    const isPublic = exercise.$jazz.owner instanceof Group && exercise.$jazz.owner.getRoleOf("everyone") === 'reader';

    const handleTogglePublic = () => {
        toggleCustomExercisePublic(exercise.$jazz.id, !isPublic);
        toast.info(t('customExercises.visibilityToggled', !isPublic ? 'Exercise is now public.' : 'Exercise is now private.'));
    };

    const selectOptions = useMemo(() => {
        const createSortedOptions = (keys: object, namespace: string) =>
            Object.keys(keys)
                .map(key => ({ value: key, label: t(`${namespace}.${key}`) }))
                .sort((a, b) => a.label.localeCompare(b.label));

        return {
            bodyParts: createSortedOptions(translations.bodyParts, 'bodyParts'),
            equipment: createSortedOptions(translations.equipment, 'equipment'),
            muscles: createSortedOptions(translations.muscles, 'muscles'),
        };
    }, [t]);

    return (
        <Card>
            <CardContent className="p-3 space-y-3">
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                        {isPublic && (
                            <Badge variant="outline" className="border-blue-500 text-blue-500">{t('customExercises.public')}</Badge>
                        )}
                    </div>
                    <Input value={localName} onChange={handleNameChange} onBlur={() => debouncedUpdateName.flush()} placeholder={t('exerciseSearch.nameYourExercise')} className="h-9 font-semibold border-0 focus-visible:ring-1 focus-visible:ring-ring bg-transparent -mx-2 flex-grow" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
                                <Ellipsis className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleDuplicate}><Copy className="mr-2 h-4 w-4" /><span>{t('customExercises.duplicate')}</span></DropdownMenuItem>
                            <DropdownMenuItem onClick={handleTogglePublic}><Share2 className="mr-2 h-4 w-4" /><span>{isPublic ? t('customExercises.makePrivate') : t('customExercises.makePublic')}</span></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>{t('common.delete')}</span></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                    <Label className="text-right text-muted-foreground">Target</Label>
                    <EditableProperty value={exercise.primaryMuscleKeys?.[0] ?? ''} options={selectOptions.muscles} placeholder="Select..." onSave={(val) => handleUpdateProperty({ primaryMuscleKeys: [val] as any })} />

                    <Label className="text-right text-muted-foreground">Body Part</Label>
                    <EditableProperty value={exercise.bodyPart} options={selectOptions.bodyParts} placeholder="Select..." onSave={(val) => handleUpdateProperty({ bodyPart: val })} />

                    <Label className="text-right text-muted-foreground">Equipment</Label>
                    <EditableProperty value={exercise.equipment} options={selectOptions.equipment} placeholder="Select..." onSave={(val) => handleUpdateProperty({ equipment: val })} />

                    <Label className="text-right text-muted-foreground self-start pt-1">Secondary</Label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {(exercise.secondaryMuscleKeys || []).map(muscle => (
                            <Badge key={muscle} variant="secondary" className="capitalize">
                                {t(`muscles.${muscle}`)}
                                <button onClick={() => handleRemoveSecondaryMuscle(muscle)} className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-background/20">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        <Popover open={isAddMuscleOpen} onOpenChange={setIsAddMuscleOpen}>
                            <PopoverTrigger asChild><Button variant="outline" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button></PopoverTrigger>
                            <PopoverContent className="p-0 w-[200px]" align="start">
                                <Command>
                                    <CommandInput placeholder={t('planEditor.addExercise')} />
                                    <CommandList>
                                        <CommandEmpty>No results found.</CommandEmpty>
                                        <CommandGroup>
                                            {selectOptions.muscles.filter(opt => ![...(exercise.secondaryMuscleKeys || [])].includes(opt.value)).map(option => (
                                                <CommandItem key={option.value} value={option.label} onSelect={() => handleAddSecondaryMuscle(option.value)}>{option.label}</CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-muted-foreground">{t('customExercises.globalNote')}</Label>
                    <Textarea
                        value={localNote}
                        onChange={handleNoteChange}
                        onBlur={() => debouncedUpdateNote.flush()}
                        placeholder={t('customExercises.notePlaceholder')}
                        className="text-sm bg-transparent"
                        rows={2}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default function CustomExercisesPage() {
    const { t } = useTranslation();
    const { customExercises } = useCustomExercises();

    const sortedExercises = useMemo(() => {
        return [...customExercises].sort((a, b) => a.name.localeCompare(b.name));
    }, [customExercises]);

    const handleCreateNew = () => {
        createCustomExercise({
            name: t('customExercises.newExerciseName'),
            bodyPart: '',
            equipment: '',
            target: '',
            primaryMuscles: [],
            secondaryMuscles: [],
            instructions: [],
        });
        toast.success(t('customExercises.exerciseCreated', 'New custom exercise created.'));
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('customExercises.pageTitle')}</h1>
                    <p className="text-muted-foreground">{t('customExercises.pageDescription')}</p>
                </div>
                <Button onClick={handleCreateNew}>
                    <Plus className="size-4 mr-2" /> {t('exerciseSearch.createExercise')}
                </Button>
            </header>

            {sortedExercises.length === 0 ? (
                <Empty className="py-16 border-2 border-dashed rounded-lg">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><Asterisk /></EmptyMedia>
                        <EmptyTitle>{t('customExercises.noExercises')}</EmptyTitle>
                        <EmptyDescription>{t('exerciseSearch.createOneNow', 'Create one to get started.')}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button variant="outline" onClick={handleCreateNew}>
                            <Plus className="size-4 mr-2" /> {t('exerciseSearch.createExercise')}
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="space-y-3">
                    {sortedExercises.map(ex => (
                        <CustomExerciseCard key={ex.$jazz.id} exercise={ex} />
                    ))}
                </div>
            )}
        </div>
    );
}