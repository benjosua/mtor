import { ExerciseSearch } from "@/components/ExerciseSearch";
import { PlanTargetInput } from "@/components/PlanTargetInput";
import { SingleValuePickerInput } from "@/components/SingleValuePickerInput";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { masterLibrary } from "@/data/master-library";
import {
    useCustomExercises,
    useSettings,
    type CustomExerciseResolved,
} from "@/jazz/db";
import { ProgressionSettings } from "@/jazz/schema";
import type { TExerciseLibraryItem } from "@/lib/types";
import { Info, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const SwitchSetting = ({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void; }) => (
    <div className="flex items-center justify-between">
        <div>
            <Label className="text-sm font-normal">{title}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
);

const SectionHeader = ({ title, description }: { title: string, description: string }) => (
    <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">
            {description}
        </p>
    </div>
);

export default function SettingsPage() {
    const { settings } = useSettings();
    const { customExercises } = useCustomExercises();
    const { i18n, t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const currentLang = i18n.language as 'en' | 'es' | 'de';
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [uiScale, setUiScale] = useState<'default' | 'large' | 'very large'>('default');

    useEffect(() => {
        const stored = localStorage.getItem('uiScale') as 'default' | 'large' | 'very large';
        if (stored) setUiScale(stored);
    }, []);

    const fullExerciseLibrary = useMemo(() => {
        const mappedCustomExercises: TExerciseLibraryItem[] = (
            customExercises || []
        )
            .filter(Boolean)
            .map((ex: CustomExerciseResolved) => ({
                id: ex.$jazz.id,
                name: ex.name,
                bodyPart: ex.bodyPart,
                equipment: ex.equipment,
                target: ex.primaryMuscleKeys?.[0] ?? '',
                primaryMuscles: ex.primaryMuscleKeys?.slice() || [],
                secondaryMuscles: ex.secondaryMuscleKeys?.slice() || [],
                instructions: ex.instructions?.slice() || [],
            }));
        const masterExercises: TExerciseLibraryItem[] = Object.entries(masterLibrary).map(([id, ex]) => {
            const bodyPartTranslation = t(`bodyParts.${ex.bodyPartKey}`);
            const equipmentTranslation = t(`equipment.${ex.equipmentKey}`);

            return {
                id,
                name: ex.name[currentLang] || ex.name.en,
                bodyPart: bodyPartTranslation.startsWith('bodyParts.') ? ex.bodyPartKey : bodyPartTranslation,
                equipment: equipmentTranslation.startsWith('equipment.') ? ex.equipmentKey : equipmentTranslation,
                primaryMuscles: ex.primaryMuscleKeys.map((key: string) => t(`muscles.${key}`)),
                target: ex.primaryMuscleKeys[0] ? t(`muscles.${ex.primaryMuscleKeys[0]}`) : 'N/A',
                secondaryMuscles: ex.secondaryMuscleKeys.map((key: string) => {
                    const translation = t(`muscles.${key}`);
                    return translation.startsWith('muscles.') ? key : translation;
                }),
                instructions: ex.instructions[currentLang] || ex.instructions.en,
            };
        });

        return [...masterExercises, ...mappedCustomExercises];
    }, [customExercises, currentLang, t]);

    const allEquipment = useMemo(() => {
        const equipmentSet = new Set<string>();
        Object.values(masterLibrary).forEach((ex) => {
            if (ex.equipmentKey && ex.equipmentKey.toLowerCase() !== "bodyweight") {
                equipmentSet.add(ex.equipmentKey);
            }
        });
        return Array.from(equipmentSet).sort();
    }, []);

    const restTimerOptions = useMemo(() => {
        const options = [];
        for (let i = 30; i <= 300; i += 15) {
            options.push({ label: `${i}s`, value: i.toString() });
        }
        return options;
    }, []);

    
    const handleToggleEquipment = (equipmentName: string) => {
        if (!settings?.availableEquipment) return;
        const currentEquipment = settings.availableEquipment.slice();
        const newSet = new Set(currentEquipment);

        if (newSet.has(equipmentName)) {
            newSet.delete(equipmentName);
        } else {
            newSet.add(equipmentName);
        }

        settings.availableEquipment.$jazz.splice(0, settings.availableEquipment.length, ...Array.from(newSet));
    };

    const handleTrackingChange = (key: "rir" | "1rm" | "10rm" | "showExerciseDetails" | "showExerciseType" | "showHistoryBadges" | "showHistoryCard" | "displayDetailedMuscles", value: boolean) => {
        if (!settings?.trackingSettings) return;
        settings.trackingSettings.$jazz.set(key, value);

        if (key === '1rm') {
            settings.trackingSettings.$jazz.set("last1rm", value);
        } else if (key === '10rm') {
            settings.trackingSettings.$jazz.set("last10rm", value);
        }
    };

    const handleRestTimerChange = (value: string) => {
        if (!settings) return;
        const seconds = parseInt(value, 10) || 90;
        settings.$jazz.set("globalRestTimer", seconds);
        toast.success(t('settings.restTimerUpdated', `Global rest timer set to ${seconds} seconds.`));
    };

    const handlePlanSettingsChange = ({
        sets,
        reps,
        rir,
    }: {
        sets?: number;
        reps?: number;
        rir?: number;
    }) => {
        if (!settings?.defaultPlanSettings) return;
        settings.defaultPlanSettings.$jazz.set("sets", sets ?? 3);
        settings.defaultPlanSettings.$jazz.set("reps", reps ?? 10);
        settings.defaultPlanSettings.$jazz.set("rir", rir);
    };

    const handleWarmupSuggestionChange = (value: boolean) => {
        if (!settings) return;
        settings.$jazz.set("warmupSuggestions", value);
    };

    const handleUiScaleChange = (scale: 'default' | 'large' | 'very large') => {
        if (!scale) return;
        localStorage.setItem('uiScale', scale);
        setUiScale(scale);
        document.documentElement.style.fontSize = { 'default': '16px', 'large': '18px', 'very large': '20px' }[scale];
        toast.success(t('settings.uiScaleUpdated', 'UI scale updated.'));
    };

    const handleWeightUnitChange = (unit: 'kg' | 'lbs') => {
        if (!settings || !unit) return;
        settings.$jazz.set("weightUnit", unit);
        toast.success(t('settings.weightUnitUpdated', `Weight unit set to ${unit}.`));
    };

    const handleLanguageChange = (language: string) => {
        i18n.changeLanguage(language).then(() => {
            localStorage.setItem('i18nextLng', language);
        }).catch(err => {
            console.error('Error changing language:', err);
        });
    };

    const handleProgressionEnabledChange = (value: boolean) => {
        if (!settings) return;
        settings.$jazz.set("progressionEnabled", value);
        toast.info(t('settings.progressionToggled', value ? 'Progression suggestions enabled.' : 'Progression suggestions disabled.'));
    };

    const handleDefaultProgressionChange = (data: { sets?: number; reps?: number; rir?: number }) => {
        if (!settings || !settings.defaultProgressionSettings) return;
        if (data.sets !== undefined) settings.defaultProgressionSettings.$jazz.set("repRangeMin", data.sets);
        if (data.reps !== undefined) settings.defaultProgressionSettings.$jazz.set("repRangeMax", data.reps);
        settings.defaultProgressionSettings.$jazz.set("rir", data.rir);
    };

    const handleSelectExerciseForOverride = (templateId: string) => {
        if (!settings?.defaultProgressionSettings) return;
        const defaults = settings.defaultProgressionSettings;
        handleSaveOverride(templateId, {
            repRangeMin: defaults.repRangeMin,
            repRangeMax: defaults.repRangeMax,
            rir: defaults.rir,
        });
        setIsSearchOpen(false);
    };

    const handleSaveOverride = (
        templateId: string,
        data: { repRangeMin: number; repRangeMax: number; rir?: number },
    ) => {
        if (!settings || !settings.progressionOverrides) return;
        settings.progressionOverrides.$jazz.set(templateId, ProgressionSettings.create({
                    repRangeMin: data.repRangeMin,
                    repRangeMax: data.repRangeMax,
                    rir: data.rir,
                }));
    };

    if (settings === undefined) {
        return <div><h1 className="text-3xl font-bold tracking-tight mb-4">Settings</h1><p>Loading settings...</p></div>;
    }

    const overrides = settings.progressionOverrides
        ? Object.entries(settings.progressionOverrides).map(([id, data]) => {
            const exercise = fullExerciseLibrary.find(e => e.id === id);
            return exercise ? { ...exercise, ...data } : null;
        }).filter(Boolean)
        : [];

    return (
        <>
            <div className="space-y-4">
                <header className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                        <p className="text-muted-foreground">{t('settings.customizeSettings')}</p>
                    </div>
                    <Button asChild variant="outline"><Link to="/">Done</Link></Button>
                </header>

                <Tabs defaultValue="appearance">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="appearance">Appearance</TabsTrigger>
                        <TabsTrigger value="training">Training</TabsTrigger>
                        <TabsTrigger value="progression">Progression</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: APPEARANCE */}
                    <TabsContent value="appearance" className="pt-4 space-y-6">
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.uiScale')} description={t('settings.uiScaleDescription')} />
                            <RadioGroup value={uiScale} onValueChange={(value) => handleUiScaleChange(value as 'default' | 'large' | 'very large')}>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="default" id="scale-default" /><Label htmlFor="scale-default">{t('common.default')}</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="large" id="scale-large" /><Label htmlFor="scale-large">{t('settings.large')}</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="very large" id="scale-very-large" /><Label htmlFor="scale-very-large">{t('settings.veryLarge')}</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.theme')} description={t('settings.themeDescription')} />
                            <RadioGroup value={theme} onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="light" id="theme-light" /><Label htmlFor="theme-light">{t('settings.light')}</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="dark" id="theme-dark" /><Label htmlFor="theme-dark">{t('settings.dark')}</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="system" id="theme-system" /><Label htmlFor="theme-system">{t('settings.system')}</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.language')} description={t('settings.languageDescription')} />
                            <Select value={i18n.language} onValueChange={handleLanguageChange}>
                                <SelectTrigger className="w-full"><SelectValue placeholder={t('settings.selectLanguage')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">{t('settings.english')}</SelectItem>
                                    <SelectItem value="es">{t('settings.spanish')}</SelectItem>
                                    <SelectItem value="de">{t('settings.german')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.workoutDisplayOptions')} description={t('settings.workoutDisplayOptionsDescription')} />
                            <div className="space-y-4">
                                <SwitchSetting title={t('settings.showExerciseDetails')} description={t('settings.showExerciseDetailsDescription')} checked={settings.trackingSettings?.["showExerciseDetails"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("showExerciseDetails", c)} />
                                <SwitchSetting title={t('settings.showExerciseType')} description={t('settings.showExerciseTypeDescription')} checked={settings.trackingSettings?.["showExerciseType"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("showExerciseType", c)} />
                                <SwitchSetting title={t('settings.showHistoryBadges')} description={t('settings.showHistoryBadgesDescription')} checked={settings.trackingSettings?.["showHistoryBadges"] ?? true} onCheckedChange={(c: boolean) => handleTrackingChange("showHistoryBadges", c)} />
                                <SwitchSetting title={t('settings.showHistoryCard')} description={t('settings.showHistoryCardDescription')} checked={settings.trackingSettings?.["showHistoryCard"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("showHistoryCard", c)} />
                                <SwitchSetting title={t('settings.displayDetailedMuscles')} description={t('settings.displayDetailedMusclesDescription')} checked={settings.trackingSettings?.["displayDetailedMuscles"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("displayDetailedMuscles", c)} />
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB 2: TRAINING */}
                    <TabsContent value="training" className="pt-4 space-y-6">
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.customExercises')} description={t('settings.customExercisesDescription')} />
                            <Button asChild variant="outline"><Link to="/custom-exercises">{t('settings.editCustomExercises')}</Link></Button>
                        </div>

                        <div className="space-y-4">
                            <SectionHeader title={t('settings.defaultsAndBehavior')} description={t('settings.defaultsAndBehaviorDescription')} />
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label>{t('settings.weightUnits')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.weightUnitsDescription')}</p>
                                    <RadioGroup value={settings.weightUnit ?? 'kg'} onValueChange={handleWeightUnitChange} className="grid grid-cols-2 gap-2 pt-1">
                                        <Label className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary"><RadioGroupItem value="kg" id="kg-unit" /><span>{t('common.kilograms')}</span></Label>
                                        <Label className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer has-[:checked]:border-primary"><RadioGroupItem value="lbs" id="lbs-unit" /><span>{t('common.pounds')}</span></Label>
                                    </RadioGroup>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('settings.globalRestTimer')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.globalRestTimerDescription')}</p>
                                    <SingleValuePickerInput label="Seconds" suffix="s" options={restTimerOptions} initialValue={settings.globalRestTimer ?? 90} onSave={handleRestTimerChange}>
                                        <Button variant="outline" className="h-auto w-full justify-center mt-1"><span className="text-lg font-semibold leading-tight">{settings.globalRestTimer ?? 90}</span><span className="ml-1.5 text-sm text-muted-foreground">{t('settings.seconds')}</span></Button>
                                    </SingleValuePickerInput>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('settings.defaultPlanTargets')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.defaultPlanTargetsDescription')}</p>
                                    <PlanTargetInput initialSets={settings.defaultPlanSettings?.sets ?? 3} initialReps={settings.defaultPlanSettings?.reps ?? 10} initialRir={settings.defaultPlanSettings?.rir ?? 2} showRir={true} onSave={handlePlanSettingsChange}>
                                        <Button variant="outline" className="h-auto w-full justify-center gap-2 px-3 py-1.5 font-normal mt-1">
                                            <div className="flex w-10 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultPlanSettings?.sets ?? 3}</span><span className="text-xs text-muted-foreground">{t('common.sets')}</span></div><X size={14} className="shrink-0 text-muted-foreground" /><div className="flex w-16 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultPlanSettings?.reps ?? 10}</span><span className="text-xs text-muted-foreground">{t('common.reps')}</span></div><div className="mx-1 h-6 w-px bg-border" /><div className="flex w-10 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultPlanSettings?.rir ?? "-"}</span><span className="text-xs text-muted-foreground">{t('common.rir')}</span></div>
                                        </Button>
                                    </PlanTargetInput>
                                </div>
                                <SwitchSetting title={t('settings.warmupSuggestions')} description={t('settings.warmupSuggestionsDescription')} checked={settings.warmupSuggestions ?? false} onCheckedChange={handleWarmupSuggestionChange} />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <SectionHeader title={t('settings.myLibrary')} description={t('settings.myLibraryDescription')} />
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label>{t('settings.availableEquipment')}</Label>
                                    <p className="text-xs text-muted-foreground">{t('settings.availableEquipmentDescription')}</p>
                                    <div className="space-y-3 pt-2">
                                        {allEquipment.map((equipment) => (
                                            <div key={equipment} className="flex items-center space-x-3">
                                                <Checkbox id={equipment} checked={settings.availableEquipment?.includes(equipment) ?? false} onCheckedChange={() => handleToggleEquipment(equipment)} /><label htmlFor={equipment} className="text-sm leading-none cursor-pointer capitalize flex-1">{t(`equipment.${equipment}`)}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* TAB 3: PROGRESSION */}
                    <TabsContent value="progression" className="pt-4 space-y-6">
                        <SwitchSetting title={t('settings.enableProgression')} description={t('settings.progressionDescription')} checked={settings.progressionEnabled ?? false} onCheckedChange={handleProgressionEnabledChange} />
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.trackingOptions')} description={t('settings.trackingOptionsDescription')} />
                            <div className="space-y-4 pt-2">
                                <SwitchSetting title="RIR (Reps in Reserve)" description={t('settings.rirDescription')} checked={settings.trackingSettings?.rir ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("rir", c)} />
                                <SwitchSetting title="Estimated 1RM" description={t('settings.e1rmDescription')} checked={settings.trackingSettings?.["1rm"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("1rm", c)} />
                                <SwitchSetting title="Estimated 10RM" description={t('settings.e10rmDescription')} checked={settings.trackingSettings?.["10rm"] ?? false} onCheckedChange={(c: boolean) => handleTrackingChange("10rm", c)} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.globalDefaults')} description={t('settings.globalDefaultsDescription')} />
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label>Target Rep Range</Label>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="size-4 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>The minimum and maximum reps to perform before increasing the weight.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <PlanTargetInput initialSets={settings.defaultProgressionSettings?.repRangeMin} initialReps={settings.defaultProgressionSettings?.repRangeMax} initialRir={settings.defaultProgressionSettings?.rir} showRir={true} onSave={handleDefaultProgressionChange}>
                                    <Button variant="outline" className="h-auto w-full justify-center gap-2 px-3 py-1.5 font-normal">
                                        <div className="flex w-16 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultProgressionSettings?.repRangeMin ?? "-"}</span><span className="text-xs text-muted-foreground">{t('settings.minReps')}</span></div><X size={14} className="shrink-0 text-muted-foreground" /><div className="flex w-16 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultProgressionSettings?.repRangeMax ?? "-"}</span><span className="text-xs text-muted-foreground">{t('settings.maxReps')}</span></div><div className="mx-1 h-6 w-px bg-border" /><div className="flex w-10 flex-col items-center"><span className="truncate text-lg font-semibold leading-tight">{settings.defaultProgressionSettings?.rir ?? "-"}</span><span className="text-xs text-muted-foreground">{t('common.rir')}</span></div>
                                    </Button>
                                </PlanTargetInput>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <SectionHeader title={t('settings.overrides')} description={t('settings.overridesDescription')} />
                            <ScrollArea className="h-48 w-full"><div className="space-y-3 pr-4">
                                {overrides.length === 0 ? (<div className="text-center py-4 text-sm text-muted-foreground">{t('settings.noOverrides')}</div>) : (
                                    overrides.map((override) => (
                                        override && (
                                            <div key={override.id} className="w-full">
                                                <PlanTargetInput initialSets={override.repRangeMin} initialReps={override.repRangeMax} initialRir={override.rir} showRir={true} onSave={(data) => { if (data.sets !== undefined && data.reps !== undefined) { handleSaveOverride(override.id, { repRangeMin: data.sets, repRangeMax: data.reps, rir: data.rir }); } }}>
                                                    <Button variant="ghost" className="w-full h-auto text-left p-2 justify-start">
                                                        <div><p className="font-medium text-sm">{override.name}</p><p className="text-xs text-muted-foreground">{override.repRangeMin}-{override.repRangeMax} reps{override.rir !== undefined ? ` @ ${override.rir} RIR` : ''}</p></div>
                                                    </Button>
                                                </PlanTargetInput>
                                            </div>
                                        )
                                    ))
                                )}
                            </div></ScrollArea>
                            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setIsSearchOpen(true)}><Plus className="size-4 mr-2" /> {t('settings.addOverride')}</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            <ExerciseSearch
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelectExercise={handleSelectExerciseForOverride}
            />
        </>
    );
}