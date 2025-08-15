import { useAccountSelector } from '@/components/AccountProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { masterLibrary, masterLibrary as staticMasterLibrary } from '@/data/master-library';
import { useResolvedExerciseDetails } from '@/hooks/useResolvedExercise';
import type { ExerciseWithRelations, PlanExerciseResolved } from '@/jazz/db';
import {
    createCustomExercise,
    useCustomExercises,
    useSettings,
} from '@/jazz/db';
import { getDisplayMuscleNames, specificToGeneralMuscleMap } from '@/lib/muscleUtils';
import type { TExerciseLibraryItem } from '@/lib/types';
import Fuse from 'fuse.js';
import {
    ArrowLeft,
    Box, Check, ChevronRight,
    Layers,
    List,
    PlusCircle, Target, TrendingUp, X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type SearchableLibraryExercise = TExerciseLibraryItem & {
    translatedBodyPart: string;
    translatedEquipment: string;
    translatedTarget: string;
    detailedMuscles: string[];
    generalMuscles: string[];
    translatedDetailedMuscles: string[];
    translatedGeneralMuscles: string[];
    name_en: string;
    bodyPart_en: string;
    equipment_en: string;
    target_en: string;
    generalMuscles_en: string[];
    detailedMuscles_en: string[];
};

type FilterCategory = 'generalMuscles' | 'detailedMuscles' | 'equipment';
type ActiveFilters = Record<FilterCategory, Set<string>>;

const FILTER_CATEGORIES: Record<FilterCategory, { displayName: string; Icon: React.ElementType }> = {
    generalMuscles: { displayName: 'Muscle Group', Icon: Layers },
    detailedMuscles: { displayName: 'Target', Icon: Target },
    equipment: { displayName: 'Equipment', Icon: Box },
};

const FUSE_OPTIONS = {
    keys: [
        'name',
        'translatedTarget',
        'translatedBodyPart',
        'translatedEquipment',
        'translatedGeneralMuscles',
        'translatedDetailedMuscles',
        'name_en',
        'target_en',
        'bodyPart_en',
        'equipment_en',
        'generalMuscles_en',
        'detailedMuscles_en',
    ],
    includeScore: true,
    threshold: 0.45,
    ignoreLocation: true,
};

type Page = 'name' | 'bodyPart' | 'equipment' | 'target' | 'secondaryMuscles';
const WIZARD_PAGES: Page[] = ['name', 'bodyPart', 'equipment', 'target', 'secondaryMuscles'];

const initialFormState: Omit<TExerciseLibraryItem, 'id' | 'instructions'> = {
    name: '',
    bodyPart: '',
    equipment: '',
    primaryMuscles: [],
    target: '',
    secondaryMuscles: [],
};

interface CreateExerciseDialogProps {
    isOpen: boolean;
    onClose: (newId?: string) => void;
    initialName?: string;
    bodyParts: { value: string; label: string }[];
    equipment: { value: string; label: string }[];
    targets: { value: string; label: string }[];
    muscles: { value: string; label: string }[];
}

function CreateExerciseDialog({ isOpen, onClose, initialName = '', bodyParts, equipment, targets, muscles }: CreateExerciseDialogProps) {
    const { t } = useTranslation();
    const [pageIndex, setPageIndex] = useState(0);
    const [formState, setFormState] = useState({ ...initialFormState, name: initialName });
    const currentPage = WIZARD_PAGES[pageIndex];

    const getPageTitle = (page: Page): string => {
        const titles: Record<Page, string> = {
            name: t('exerciseSearch.nameYourExercise'),
            bodyPart: t('exerciseSearch.selectBodyPart'),
            equipment: t('exerciseSearch.selectEquipment'),
            target: t('exerciseSearch.selectTargetMuscle'),
            secondaryMuscles: t('exerciseSearch.selectSecondaryMuscles'),
        };
        return titles[page];
    };

    useEffect(() => {
        if (isOpen) {
            setPageIndex(0);
            setFormState({ ...initialFormState, name: initialName });
        }
    }, [isOpen, initialName]);

    const handleSave = async () => {
        const { name, bodyPart, equipment, primaryMuscles } = formState;
        if (!name.trim() || !bodyPart || !equipment || primaryMuscles.length === 0) return;
        const newExerciseData = { ...formState, instructions: [] };
        const newId = await createCustomExercise(newExerciseData);
        onClose(newId);
    };

    const goNext = () => setPageIndex(i => Math.min(i + 1, WIZARD_PAGES.length - 1));
    const goBack = () => setPageIndex(i => Math.max(i - 1, 0));

    const handleSingleSelect = (field: 'bodyPart' | 'equipment' | 'target', value: string) => {
        setFormState(s => {
            if (field === 'target') {

                return { ...s, primaryMuscles: [value] };
            }
            return { ...s, [field]: value };
        });
    };

    const handleMultiSelect = (muscle: string) => setFormState(s => ({ ...s, secondaryMuscles: s.secondaryMuscles.includes(muscle) ? s.secondaryMuscles.filter(m => m !== muscle) : [...s.secondaryMuscles, muscle] }));

    const isNextDisabled = useMemo(() => {
        switch (currentPage) {
            case 'name': return !formState.name.trim();
            case 'bodyPart': return !formState.bodyPart;
            case 'equipment': return !formState.equipment;
            case 'target': return formState.primaryMuscles.length === 0;
            default: return false;
        }
    }, [currentPage, formState]);

    const renderPageContent = () => {
        switch (currentPage) {
            case 'name': return <Input id="name" value={formState.name} onChange={e => setFormState(s => ({ ...s, name: e.target.value }))} placeholder="e.g., Barbell Bench Press" />;
            case 'bodyPart': case 'equipment': case 'target':
                const items = currentPage === 'bodyPart' ? bodyParts : currentPage === 'equipment' ? equipment : targets;
                const isChecked = (itemValue: string) => currentPage === 'target' ? formState.primaryMuscles[0] === itemValue : formState[currentPage as 'bodyPart' | 'equipment'] === itemValue;
                return <ScrollArea className="h-64"><div className="flex flex-col gap-3 pr-4">{items.map(item => <div key={item.value} className="flex items-center gap-3"><Checkbox id={`${currentPage}-${item.value}`} checked={isChecked(item.value)} onCheckedChange={() => handleSingleSelect(currentPage, item.value)} /><Label htmlFor={`${currentPage}-${item.value}`} className="capitalize flex-1 cursor-pointer">{item.label}</Label></div>)}</div></ScrollArea>;
            case 'secondaryMuscles':
                return <ScrollArea className="h-64"><div className="flex flex-col gap-3 pr-4">{muscles.map(muscle => <div key={muscle.value} className="flex items-center gap-3"><Checkbox id={`muscle-${muscle.value}`} checked={formState.secondaryMuscles.includes(muscle.value)} onCheckedChange={() => handleMultiSelect(muscle.value)} /><Label htmlFor={`muscle-${muscle.value}`} className="capitalize flex-1 cursor-pointer">{muscle.label}</Label></div>)}</div></ScrollArea>;
            default: return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{getPageTitle(currentPage)}</DialogTitle>{currentPage === 'name' && <DialogDescription>{t('exerciseSearch.goodNameHint')}</DialogDescription>}</DialogHeader>
                <div className="py-4">{renderPageContent()}</div>
                <DialogFooter>{pageIndex > 0 && <Button variant="ghost" onClick={goBack}>{t('common.back')}</Button>}<div className="flex-grow" />{pageIndex < WIZARD_PAGES.length - 1 ? <Button onClick={goNext} disabled={isNextDisabled}>{t('common.next')}</Button> : <Button onClick={handleSave} disabled={isNextDisabled}>{t('exerciseSearch.createExercise')}</Button>}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ExerciseSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectExercise: (exerciseId: string) => void;
    exerciseToSwap?: ExerciseWithRelations | PlanExerciseResolved;
    exerciseToRemap?: PlanExerciseResolved;
}

export function ExerciseSearch({
    isOpen,
    onClose,
    onSelectExercise,
    exerciseToSwap,
    exerciseToRemap,
}: ExerciseSearchProps) {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language as 'en' | 'es';
    const t_en = i18n.getFixedT('en'); // Get a t function specifically for English

    const { plans, sessions } = useAccountSelector({
        select: (me) => ({
            plans: me.root?.plans,
            sessions: me.root?.sessions
        })
    });

    const { settings } = useSettings();
    const { customExercises: unsortedCustomExercises } = useCustomExercises();
    const listRef = useRef<HTMLDivElement>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ generalMuscles: new Set(), detailedMuscles: new Set(), equipment: new Set() });
    const [activeFilterCategory, setActiveFilterCategory] = useState<FilterCategory | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'default' | 'more_alternatives'>('default');

    const displayDetailed = settings?.trackingSettings?.displayDetailedMuscles ?? false;

    const baseLibrary = useMemo(() => {
        const getUnique = <T,>(arr: T[]): T[] => [...new Set(arr)];
        const getTranslated = (keys: string[], namespace: 'muscles' | 'generalMuscles', translateFunc: typeof t) => keys.map(key => translateFunc(`${namespace}.${key}`));

        const masterExercises: SearchableLibraryExercise[] = Object.entries(masterLibrary).map(([id, ex]) => {
            const detailedMuscles = getUnique(ex.primaryMuscleKeys);
            const generalMuscles = getUnique(ex.primaryMuscleKeys.map(key => specificToGeneralMuscleMap[key]).filter(Boolean));

            return {
                id,
                name: ex.name[currentLang] || ex.name.en,
                bodyPart: ex.bodyPartKey as string,
                equipment: ex.equipmentKey as string,
                target: ex.primaryMuscleKeys[0] || '',
                primaryMuscles: ex.primaryMuscleKeys as string[],
                secondaryMuscles: ex.secondaryMuscleKeys,
                instructions: ex.instructions[currentLang] || ex.instructions.en,
                translatedBodyPart: t(`bodyParts.${ex.bodyPartKey}`),
                translatedEquipment: t(`equipment.${ex.equipmentKey}`),
                translatedTarget: getDisplayMuscleNames({ specificKeys: ex.primaryMuscleKeys, displayDetailed, t })[0] || '',
                translatedDetailedMuscles: getTranslated(detailedMuscles, 'muscles', t),
                translatedGeneralMuscles: getTranslated(generalMuscles, 'generalMuscles', t),
                detailedMuscles,
                generalMuscles,
                name_en: ex.name.en,
                bodyPart_en: t_en(`bodyParts.${ex.bodyPartKey}`),
                equipment_en: t_en(`equipment.${ex.equipmentKey}`),
                target_en: getDisplayMuscleNames({ specificKeys: ex.primaryMuscleKeys, displayDetailed, t: t_en })[0] || '',
                detailedMuscles_en: getTranslated(detailedMuscles, 'muscles', t_en),
                generalMuscles_en: getTranslated(generalMuscles, 'generalMuscles', t_en),
            };
        });

        const mappedCustomExercises: SearchableLibraryExercise[] = (unsortedCustomExercises || [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(ex => {
                const rawPrimaryKeys = (ex as any).primaryMuscleKeys || [(ex as any).target];
                const rawSecondaryKeys = (ex as any).secondaryMuscleKeys || (ex as any).secondaryMuscles || [];

                const primaryKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
                const secondaryKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));
                const detailedMuscles = getUnique(primaryKeys);
                const generalMuscles = getUnique(primaryKeys.map(key => specificToGeneralMuscleMap[key]).filter(Boolean));

                return {
                    id: ex.$jazz.id,
                    name: ex.name,
                    bodyPart: ex.bodyPart,
                    equipment: ex.equipment,
                    target: primaryKeys[0] || '',
                    primaryMuscles: primaryKeys,
                    secondaryMuscles: secondaryKeys as string[],
                    instructions: ex.instructions?.slice() || [],

                    translatedBodyPart: ex.bodyPart ? t(`bodyParts.${ex.bodyPart}`) : '',
                    translatedEquipment: ex.equipment ? t(`equipment.${ex.equipment}`) : '',
                    translatedTarget: getDisplayMuscleNames({ specificKeys: primaryKeys, displayDetailed, t })[0] || '',
                    translatedDetailedMuscles: getTranslated(detailedMuscles, 'muscles', t),
                    translatedGeneralMuscles: getTranslated(generalMuscles, 'generalMuscles', t),

                    detailedMuscles,
                    generalMuscles,

                    name_en: ex.name,
                    bodyPart_en: ex.bodyPart ? t_en(`bodyParts.${ex.bodyPart}`) : '',
                    equipment_en: ex.equipment ? t_en(`equipment.${ex.equipment}`) : '',
                    target_en: getDisplayMuscleNames({ specificKeys: primaryKeys, displayDetailed, t: t_en })[0] || '',
                    detailedMuscles_en: getTranslated(detailedMuscles, 'muscles', t_en),
                    generalMuscles_en: getTranslated(generalMuscles, 'generalMuscles', t_en),
                };
            });

        const fullLibrary: SearchableLibraryExercise[] = [...masterExercises, ...mappedCustomExercises];
        const availableEquipment = settings?.availableEquipment;

        if (!availableEquipment || availableEquipment.length === 0) return fullLibrary;
        return fullLibrary.filter(ex => availableEquipment.includes(ex.equipment) || ex.equipment.toLowerCase() === 'bodyweight');
    }, [settings?.availableEquipment, unsortedCustomExercises, currentLang, t, displayDetailed, t_en]);

    const { allBodyParts, allEquipment, allTargets, allMuscles } = useMemo(() => {
        const bodyParts = new Map<string, string>();
        const equipment = new Map<string, string>();
        const targets = new Map<string, string>();
        const muscles = new Map<string, string>();
        Object.values(masterLibrary).forEach(ex => {
            if (ex.bodyPartKey) bodyParts.set(ex.bodyPartKey, t(`bodyParts.${ex.bodyPartKey}`));
            if (ex.equipmentKey) equipment.set(ex.equipmentKey, t(`equipment.${ex.equipmentKey}`));

            if (ex.primaryMuscleKeys && ex.primaryMuscleKeys.length > 0) {
                const primaryKey = ex.primaryMuscleKeys[0];
                const translatedTarget = t(`muscles.${primaryKey}`);
                targets.set(primaryKey, translatedTarget);
                muscles.set(primaryKey, translatedTarget);
            }
            ex.primaryMuscleKeys.forEach(m => muscles.set(m, t(`muscles.${m}`)));
            ex.secondaryMuscleKeys.forEach(m => muscles.set(m, t(`muscles.${m}`)));
        });

        const toSortedArray = (map: Map<string, string>) =>
            Array.from(map.entries())
                .map(([value, label]) => ({ value, label }))
                .sort((a, b) => a.label.localeCompare(b.label));

        return {
            allBodyParts: toSortedArray(bodyParts),
            allEquipment: toSortedArray(equipment),
            allTargets: toSortedArray(targets),
            allMuscles: toSortedArray(muscles),
        };
    }, [t]);

    const getFilteredExercises = useCallback((filters: ActiveFilters): SearchableLibraryExercise[] => {
        const activeFilterEntries = Object.entries(filters).filter(([, values]) => values.size > 0);
        if (activeFilterEntries.length === 0) return baseLibrary;
        return baseLibrary.filter(exercise =>
            activeFilterEntries.every(([key, values]) => {
                const category = key as FilterCategory;

                const exerciseValues = exercise[category];
                if (Array.isArray(exerciseValues)) return Array.from(values).some(v => exerciseValues.includes(v as string));

                if (typeof exerciseValues === 'string') return values.has(exerciseValues);
                return false;
            })
        );
    }, [baseLibrary]);

    const filteredByCategories = useMemo(() => getFilteredExercises(activeFilters), [activeFilters, getFilteredExercises]);
    const fuse = useMemo(() => new Fuse(filteredByCategories, FUSE_OPTIONS), [filteredByCategories]);
    const finalExercises = useMemo(() => searchTerm ? fuse.search(searchTerm).map(result => result.item) : filteredByCategories, [searchTerm, filteredByCategories, fuse]);

    const getAvailableFilterOptions = useCallback((category: FilterCategory): Map<string, number> => {
        const filtersWithoutCategory = { ...activeFilters, [category]: new Set() };
        const compatibleExercises = getFilteredExercises(filtersWithoutCategory);
        const valueMap = new Map<string, number>();

        compatibleExercises.forEach(ex => {
            const values = Array.isArray(ex[category]) ? ex[category] : [ex[category]];

            if (category === 'detailedMuscles' && activeFilters.generalMuscles.size > 0) {
                (values as string[]).forEach(detailedMuscle => {
                    const generalGroup = specificToGeneralMuscleMap[detailedMuscle];
                    if (generalGroup && activeFilters.generalMuscles.has(generalGroup)) {
                        valueMap.set(detailedMuscle, (valueMap.get(detailedMuscle) || 0) + 1);
                    }
                });
            }
            else if (category === 'generalMuscles' && activeFilters.detailedMuscles.size > 0) {
                (values as string[]).forEach(generalMuscle => {
                    const hasMatchingDetailed = Array.from(activeFilters.detailedMuscles).some(
                        detailedMuscle => specificToGeneralMuscleMap[detailedMuscle] === generalMuscle
                    );
                    if (hasMatchingDetailed || activeFilters.detailedMuscles.size === 0) {
                        valueMap.set(generalMuscle, (valueMap.get(generalMuscle) || 0) + 1);
                    }
                });
            }
            else {
                (values as string[]).forEach(val => {
                    if (val) valueMap.set(val, (valueMap.get(val) || 0) + 1);
                });
            }
        });
        return new Map([...valueMap.entries()].sort((a, b) => b[1] - a[1]));
    }, [activeFilters, getFilteredExercises]);

    const popularExercises = useMemo(() => {
        if (!plans || !sessions) return [];
        const usageCounts = new Map<string, number>();
        plans?.forEach(plan => plan?.days?.forEach(day => day?.exercises?.forEach(exercise => { if (exercise?.templateId) usageCounts.set(exercise.templateId, (usageCounts.get(exercise.templateId) || 0) + 1); })));
        sessions?.forEach(session => session?.exercises?.forEach(exercise => { if (exercise?.templateId) usageCounts.set(exercise.templateId, (usageCounts.get(exercise.templateId) || 0) + 1); }));
        const sortedIds = Array.from(usageCounts.entries()).sort((a, b) => b[1] - a[1]).map(entry => entry[0]);
        return sortedIds.map(id => baseLibrary.find(e => e.id === id)).filter((e): e is SearchableLibraryExercise => !!e);
    }, [plans, sessions, baseLibrary]);

    const { recommendedSwaps, remainingPopular, allAlternatives } = useMemo(() => {
        if (!exerciseToSwap?.templateId) return { recommendedSwaps: [], remainingPopular: popularExercises, allAlternatives: [] };

        const { templateId } = exerciseToSwap;

        const libraryMasterEntry = staticMasterLibrary[templateId];
        const libraryCustomEntry = unsortedCustomExercises?.find(e => e.$jazz.id === templateId);

        let target: string | undefined;
        let secondaryMuscles: readonly string[] | string[] | undefined;
        let equipment: string | undefined;

        if (libraryMasterEntry) {
            target = libraryMasterEntry.primaryMuscleKeys[0];
            secondaryMuscles = libraryMasterEntry.secondaryMuscleKeys;
            equipment = libraryMasterEntry.equipmentKey;
        } else if (libraryCustomEntry) {
            target = libraryCustomEntry.primaryMuscleKeys?.[0];
            secondaryMuscles = libraryCustomEntry.secondaryMuscleKeys ?? [];
            equipment = libraryCustomEntry.equipment;
        }
        if (!target) return { recommendedSwaps: [], remainingPopular: popularExercises, allAlternatives: [] }; const originalSecondary = new Set(secondaryMuscles || []);
        const alternatives = baseLibrary.filter(ex => ex.target === target && ex.id !== templateId);

        const sortedAlternatives = [...alternatives].sort((a, b) => {
            const matchingA = (a.secondaryMuscles || []).filter(m => originalSecondary.has(m)).length;
            const matchingB = (b.secondaryMuscles || []).filter(m => originalSecondary.has(m)).length;
            if (matchingB !== matchingA) return matchingB - matchingA;
            const sameEquipA = a.equipment === equipment ? 1 : 0;
            const sameEquipB = b.equipment === equipment ? 1 : 0;
            if (sameEquipB !== sameEquipA) return sameEquipB - sameEquipA;
            return a.name.localeCompare(b.name);
        });

        const popularInTarget = popularExercises.filter(ex => ex.target === target && ex.id !== templateId);
        const popularIds = new Set(popularInTarget.map(ex => ex.id));
        const remaining = popularExercises.filter(ex => !popularIds.has(ex.id) && ex.id !== templateId);

        return { recommendedSwaps: popularInTarget, remainingPopular: remaining, allAlternatives: sortedAlternatives };
    }, [baseLibrary, popularExercises, exerciseToSwap, unsortedCustomExercises]);

    const resetState = () => {
        setSearchTerm('');
        setActiveFilters({ generalMuscles: new Set(), detailedMuscles: new Set(), equipment: new Set() });
        setActiveFilterCategory(null);
        setViewMode('default');
    };

    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(resetState, 300);
            return () => clearTimeout(timer);
        }
        setViewMode('default');
    }, [isOpen]);

    const handleToggleFilter = useCallback((category: FilterCategory, value: string) => {
        setActiveFilters(prev => {
            const newCategoryFilters = new Set(prev[category]);
            if (newCategoryFilters.has(value)) {
                newCategoryFilters.delete(value);
            } else {
                newCategoryFilters.add(value);
            }
            return { ...prev, [category]: newCategoryFilters };
        });
    }, []);

    const handleSelectFilterOption = (category: FilterCategory, value: string) => {
        handleToggleFilter(category, value);
        setActiveFilterCategory(null);
    };

    const handleSelectResult = (exerciseId: string) => {
        const exercise = baseLibrary.find(e => e.id === exerciseId);
        if (exercise) {
            onSelectExercise(exercise.id);
        }
    };

    const handleCreateDialogClose = (newId?: string) => {
        setIsCreateOpen(false);
        if (typeof newId === 'string') {
            onSelectExercise(newId);
        }
    };

    const openCreateDialog = () => {
        setIsCreateOpen(true);
    };

    const resolvedSwapDetails = useResolvedExerciseDetails(exerciseToSwap);
    const resolvedRemapDetails = useResolvedExerciseDetails(exerciseToRemap);
    const placeholderText = exerciseToRemap
        ? t('exerciseSearch.remapPlaceholder', { name: resolvedRemapDetails?.name || t('common.exercise') })
        : exerciseToSwap
            ? t('exerciseSearch.swapPlaceholder', { name: resolvedSwapDetails?.name || t('common.exercise') })
            : t('exerciseSearch.searchPlaceholder');

    const hasActiveFilters = Object.values(activeFilters).some(s => s.size > 0);

    const renderContent = () => {
        if (activeFilterCategory) {
            return (
                <FilterOptionsList
                    category={activeFilterCategory}
                    activeFilters={activeFilters}
                    onToggleFilter={handleSelectFilterOption}
                    onBack={() => setActiveFilterCategory(null)}
                    getAvailableFilterOptions={getAvailableFilterOptions}
                />
            );
        }

        if (viewMode === 'more_alternatives' && exerciseToSwap) {
            return (
                <AllAlternativesView
                    exerciseToSwap={exerciseToSwap}
                    allAlternatives={allAlternatives}
                    onSelect={handleSelectResult}
                    onBack={() => setViewMode('default')}
                />
            );
        }

        const trimmedSearch = searchTerm.trim();
        if (trimmedSearch || hasActiveFilters || exerciseToRemap) {
            return (
                <SearchResultsView
                    searchTerm={trimmedSearch}
                    exercises={finalExercises}
                    onSelect={handleSelectResult}
                    onCreateNew={openCreateDialog}
                />
            );
        }

        if (exerciseToSwap) {
            return (
                <SwapView
                    exerciseToSwap={exerciseToSwap}
                    recommendedSwaps={recommendedSwaps}
                    remainingPopular={remainingPopular}
                    allAlternatives={allAlternatives}
                    onSelect={handleSelectResult}
                    onViewMore={() => setViewMode('more_alternatives')}
                />
            );
        }

        return (
            <InitialView
                popularExercises={popularExercises}
                onSelect={handleSelectResult}
                onCreateCustom={openCreateDialog}
            />
        );
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="p-0 gap-0 sm:max-h-[80vh] sm:max-w-2xl flex flex-col" showCloseButton={false}>
                    <Command
                        shouldFilter={false}
                        className="flex flex-col flex-1"
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Backspace' && activeFilterCategory && !searchTerm) {
                                e.preventDefault();
                                setActiveFilterCategory(null);
                            }
                        }}
                    >
                        <div className="relative flex items-center">
                            <CommandInput
                                value={searchTerm}
                                onValueChange={(value) => {
                                    setSearchTerm(value);
                                    listRef.current?.scrollTo(0, 0);
                                }}
                                placeholder={placeholderText}
                                className="focus:ring-0 text-base h-12 px-4 rounded-b-none"
                                autoFocus={false}
                            />
                            <button
                                onClick={onClose}
                                className="absolute right-4 p-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </button>
                        </div>

                        {hasActiveFilters && (
                            <ActiveFiltersDisplay
                                activeFilters={activeFilters}
                                onToggleFilter={handleToggleFilter}
                            />
                        )}

                        <FilterCategoryBadges onSelect={setActiveFilterCategory} />

                        <CommandList ref={listRef} className="h-full">
                            {renderContent()}
                        </CommandList>
                    </Command>
                </DialogContent>
            </Dialog>
            <CreateExerciseDialog
                isOpen={isCreateOpen}
                onClose={handleCreateDialogClose}
                initialName={searchTerm}
                bodyParts={allBodyParts}
                equipment={allEquipment}
                targets={allTargets}
                muscles={allMuscles}
            />
        </>
    );
}

// =================================================================================

const ExerciseItem = ({ exercise, onSelect, Icon }: { exercise: TExerciseLibraryItem; onSelect: (id: string) => void; Icon?: React.ElementType }) => {
    const { t } = useTranslation();
    const translatedTarget = exercise.target ? t(`muscles.${exercise.target}`) : '';
    return (
        <CommandItem onSelect={() => onSelect(exercise.id)} className="flex justify-between items-center cursor-pointer">
            <div className="flex items-center min-w-0">
                {Icon && <Icon className="mr-2 size-4 text-muted-foreground flex-shrink-0" />}
                <span className="capitalize truncate">{exercise.name}</span>
                {exercise.id.startsWith('custom_') && <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">Custom</Badge>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize ml-2 flex-shrink-0">
                <span>{translatedTarget}</span>
                <ChevronRight className="size-4" />
            </div>
        </CommandItem>
    );
};

const ExerciseListGroup = ({ heading, exercises, onSelect, Icon, limit = 50 }: { heading: string; exercises: TExerciseLibraryItem[]; onSelect: (id: string) => void; Icon?: React.ElementType; limit?: number }) => (
    <CommandGroup heading={heading}>
        {exercises.slice(0, limit).map(ex => <ExerciseItem key={ex.id} exercise={ex} onSelect={onSelect} Icon={Icon} />)}
    </CommandGroup>
);

const FilterCategoryBadges = ({ onSelect }: { onSelect: (category: FilterCategory) => void }) => (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-muted/50">
        {Object.entries(FILTER_CATEGORIES).map(([key, { displayName, Icon }]) => (
            <Button
                key={key}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs bg-background hover:bg-muted"
                onClick={() => onSelect(key as FilterCategory)}
            >
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{displayName}</span>
            </Button>
        ))}
    </div>
);

const ActiveFiltersDisplay = ({ activeFilters, onToggleFilter }: { activeFilters: ActiveFilters; onToggleFilter: (category: FilterCategory, value: string) => void }) => {
    const { t } = useTranslation();
    const keyMap = { generalMuscles: 'generalMuscles', detailedMuscles: 'muscles', equipment: 'equipment' };
    const getFilterCategoryName = (category: FilterCategory): string => {
        const names: Record<FilterCategory, string> = {
            generalMuscles: t('exerciseSearch.filterMuscleGroup'),
            detailedMuscles: t('exerciseSearch.filterTarget'),
            equipment: t('exerciseSearch.filterEquipment'),
        };
        return names[category];
    };
    return (
        <div className="flex flex-wrap items-center gap-1.5 p-2 pb-2 border-b">
            {(Object.entries(activeFilters) as [FilterCategory, Set<string>][]).flatMap(([category, values]) =>
                Array.from(values).map(value => (
                    <Badge key={`${category}-${value}`} variant="secondary" className="gap-1 pr-1">
                        <span className="text-xs font-normal text-muted-foreground">{getFilterCategoryName(category)}:</span>
                        {t(`${keyMap[category]}.${value}`)}
                        <button onClick={() => onToggleFilter(category, value)} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                            <X className="size-3" />
                        </button>
                    </Badge>
                ))
            )}
        </div>
    );
};

const FilterOptionsList = ({ category, activeFilters, onToggleFilter, onBack, getAvailableFilterOptions }: { category: FilterCategory; activeFilters: ActiveFilters; onToggleFilter: (category: FilterCategory, value: string) => void; onBack: () => void; getAvailableFilterOptions: (category: FilterCategory) => Map<string, number> }) => {
    const { t } = useTranslation();
    const getFilterCategoryName = (cat: FilterCategory): string => {
        const names: Record<FilterCategory, string> = {
            generalMuscles: t('exerciseSearch.filterMuscleGroup'),
            detailedMuscles: t('exerciseSearch.filterTarget'),
            equipment: t('exerciseSearch.filterEquipment'),
        };
        return names[cat];
    };
    const displayName = getFilterCategoryName(category);
    const availableOptions = getAvailableFilterOptions(category);
    const activeInCategory = activeFilters[category] || new Set<string>();
    const namespace = ({ generalMuscles: 'generalMuscles', detailedMuscles: 'muscles', equipment: 'equipment' } as const)[category];

    return (
        <>
            <CommandGroup>
                <CommandItem onSelect={onBack} className="font-medium text-muted-foreground cursor-pointer">
                    <ArrowLeft className="mr-2 size-4" />Back to Results
                </CommandItem>
            </CommandGroup>
            <CommandGroup heading={`Select ${displayName}`}>
                {Array.from(availableOptions.entries()).map(([value, count]) => {
                    const isActive = activeInCategory.has(value);
                    const translatedValue = namespace ? t(`${namespace}.${value}`) : value;
                    return (
                        <CommandItem key={`${category}-${value}`} onSelect={() => onToggleFilter(category, value)} className="cursor-pointer">
                            <div className="flex items-center flex-1">
                                <div className="mr-2 size-4 flex items-center justify-center">
                                    {isActive && <Check className="size-4 text-primary" />}
                                </div>
                                <span className={isActive ? 'text-primary font-medium' : ''}>{translatedValue}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                            </div>
                        </CommandItem>
                    );
                })}
            </CommandGroup>
        </>
    );
};

const InitialView = ({ popularExercises, onSelect, onCreateCustom }: { popularExercises: TExerciseLibraryItem[]; onSelect: (id: string) => void; onCreateCustom: () => void; }) => (
    <>
        {popularExercises.length > 0 && <ExerciseListGroup heading="Frequently Used" exercises={popularExercises.slice(0, 5)} onSelect={onSelect} Icon={TrendingUp} />}
        <CommandGroup>
            <CommandItem onSelect={onCreateCustom} className="cursor-pointer">
                <PlusCircle className="mr-2 size-4" />Create a custom exercise
            </CommandItem>
        </CommandGroup>
    </>
);

const SearchResultsView = ({ searchTerm, exercises, onSelect, onCreateNew }: { searchTerm: string; exercises: TExerciseLibraryItem[]; onSelect: (id: string) => void; onCreateNew: () => void; }) => {
    const showCreateOption = searchTerm.length > 1 && !exercises.some(ex => ex.name.toLowerCase() === searchTerm.toLowerCase());
    return (
        <>
            <CommandEmpty>
                <div className="py-6 text-center text-sm">
                    <p className="font-semibold">No exercises found</p>
                    <p className="mt-1 text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
            </CommandEmpty>
            {exercises.length > 0 && <ExerciseListGroup heading={`Results (${exercises.length})`} exercises={exercises} onSelect={onSelect} />}
            {showCreateOption && (
                <CommandGroup>
                    <CommandItem onSelect={onCreateNew} className="cursor-pointer">
                        <PlusCircle className="mr-2 size-4" />Create a new exercise named "{searchTerm}"
                    </CommandItem>
                </CommandGroup>
            )}
        </>
    );
};

const SwapView = ({ exerciseToSwap, recommendedSwaps, remainingPopular, allAlternatives, onSelect, onViewMore }: { exerciseToSwap: ExerciseWithRelations | PlanExerciseResolved; recommendedSwaps: TExerciseLibraryItem[]; remainingPopular: TExerciseLibraryItem[]; allAlternatives: TExerciseLibraryItem[]; onSelect: (id: string) => void; onViewMore: () => void; }) => {
    const resolvedDetails = useResolvedExerciseDetails(exerciseToSwap);
    const hasRecommendations = recommendedSwaps.length > 0;
    const hasAlternatives = allAlternatives.length > 0;

    return (
        <>
            {(hasRecommendations || hasAlternatives) && resolvedDetails?.target && (
                <CommandGroup heading={`Alternatives for ${resolvedDetails.target}`}>
                    {recommendedSwaps.slice(0, 5).map(ex => <ExerciseItem key={`rec-${ex.id}`} exercise={ex} onSelect={onSelect} Icon={TrendingUp} />)}
                    {hasAlternatives && (
                        <CommandItem onSelect={onViewMore} className="cursor-pointer">
                            <List className="mr-2 size-4" /> View all {allAlternatives.length} alternatives...
                        </CommandItem>
                    )}
                </CommandGroup>
            )}
            {remainingPopular.length > 0 && <ExerciseListGroup heading="Other Frequently Used" exercises={remainingPopular.slice(0, 5)} onSelect={onSelect} Icon={TrendingUp} />}
        </>
    );
};

const AllAlternativesView = ({ exerciseToSwap, allAlternatives, onSelect, onBack }: { exerciseToSwap: ExerciseWithRelations | PlanExerciseResolved; allAlternatives: TExerciseLibraryItem[]; onSelect: (id: string) => void; onBack: () => void; }) => {
    const resolvedDetails = useResolvedExerciseDetails(exerciseToSwap);
    return (
        <>
            <CommandGroup>
                <CommandItem onSelect={onBack} className="font-medium text-muted-foreground cursor-pointer">
                    <ArrowLeft className="mr-2 size-4" />Back to Recommendations
                </CommandItem>
            </CommandGroup>
            <ExerciseListGroup heading={`All ${resolvedDetails?.target} Exercises`} exercises={allAlternatives} onSelect={onSelect} />
        </>
    );
};