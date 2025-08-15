import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WeightPlateCalculatorProps {
    isOpen: boolean;
    onClose: () => void;
    initialWeight?: number;
}

const ALL_PLATE_WEIGHTS = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const DEFAULT_BARBELL_WEIGHT = 20; 

const PLATE_COLORS: Record<number, string> = {
    25: '#ef4444', 
    20: '#3b82f6', 
    15: '#eab308', 
    10: '#22c55e', 
    5: '#ffffff', 
    2.5: '#6b7280', 
    1.25: '#8b5cf6', 
    0.5: '#f97316', 
};

function calculatePlates(totalWeight: number, availablePlates: number[], barbellWeight: number) {
    if (isNaN(totalWeight) || totalWeight <= barbellWeight) {
        return { platesPerSide: [], remainingWeight: 0 };
    }

    let weightPerSide = (totalWeight - barbellWeight) / 2;
    const platesPerSide: { weight: number; count: number }[] = [];

    
    const sortedPlates = [...availablePlates].sort((a, b) => b - a);

    for (const plateWeight of sortedPlates) {
        const count = Math.floor(weightPerSide / plateWeight);
        if (count > 0) {
            platesPerSide.push({ weight: plateWeight, count });
            weightPerSide -= count * plateWeight;
        }
    }

    const remainingWeight = Math.round(weightPerSide * 2 * 100) / 100;

    return { platesPerSide, remainingWeight };
}

function BarbellVisualization({ platesPerSide }: { platesPerSide: { weight: number; count: number }[] }) {
    const PLATE_THICKNESS = 10; 
    const BAR_HEIGHT = 4;       

    
    const getPlateHeight = (weight: number) => {
        const maxHeight = 80;
        const minHeight = 20;
        const maxPlateWeight = 25; 
        return minHeight + (weight / maxPlateWeight) * (maxHeight - minHeight);
    };

    
    const allPlates = platesPerSide
        .flatMap(({ weight, count }) => Array(count).fill(weight))
        .sort((a, b) => b - a);

    return (
        <div className="relative flex items-center w-full h-[100px]">
            {}
            <div
                className="absolute w-full bg-gray-500 top-1/2 -translate-y-1/2"
                style={{ height: `${BAR_HEIGHT}px` }}
            />

            {}
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 flex items-center">
                {}
                <div
                    className="bg-gray-600"
                    style={{ width: '4px', height: '16px' }}
                />

                {}
                {allPlates.map((weight, index) => {
                    const plateHeight = getPlateHeight(weight);
                    return (
                        <div
                            key={`${weight}-${index}`}
                            style={{
                                backgroundColor: PLATE_COLORS[weight],
                                height: `${plateHeight}px`,
                                width: `${PLATE_THICKNESS}px`,
                                
                                borderRight: '1px solid rgba(0,0,0,0.2)',
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export function WeightPlateCalculator({ isOpen, onClose, initialWeight }: WeightPlateCalculatorProps) {
    const { t } = useTranslation();
    const [targetWeight, setTargetWeight] = useState<string>('');
    const [barbellWeight, setBarbellWeight] = useState<string>(DEFAULT_BARBELL_WEIGHT.toString());
    const [availablePlates, setAvailablePlates] = useState<string[]>(
        ALL_PLATE_WEIGHTS.map(w => w.toString())
    );

    useEffect(() => {
        if (isOpen) {
            setTargetWeight(initialWeight?.toString() ?? '');
        }
    }, [isOpen, initialWeight]);

    const selectedPlateWeights = useMemo(
        () => availablePlates.map(p => parseFloat(p)).sort((a, b) => b - a),
        [availablePlates]
    );

    const currentBarbellWeight = useMemo(() => parseFloat(barbellWeight) || DEFAULT_BARBELL_WEIGHT, [barbellWeight]);

    const { platesPerSide, remainingWeight } = useMemo(
        () => calculatePlates(parseFloat(targetWeight), selectedPlateWeights, currentBarbellWeight),
        [targetWeight, selectedPlateWeights, currentBarbellWeight]
    );

    const totalCalculatedWeight = useMemo(() => {
        if (platesPerSide.length === 0) return currentBarbellWeight;
        const plateWeight = platesPerSide.reduce((sum, { weight, count }) => sum + (weight * count * 2), 0);
        return currentBarbellWeight + plateWeight;
    }, [platesPerSide, currentBarbellWeight]);

    return (
        <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-2xl">
                    <DrawerHeader>
                        <DrawerTitle>{t('plateCalculator.title')}</DrawerTitle>
                        <DrawerDescription>{t('plateCalculator.description')}</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 space-y-6">
                        {/* Available Plates Toggle */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">{t('plateCalculator.availablePlates')}</Label>
                            <ToggleGroup
                                type="multiple"
                                value={availablePlates}
                                onValueChange={setAvailablePlates}
                                className="flex flex-wrap gap-2"
                            >
                                {ALL_PLATE_WEIGHTS.map(weight => (
                                    <ToggleGroupItem
                                        key={weight}
                                        value={weight.toString()}
                                        className="px-3 py-1 text-sm"
                                        style={{
                                            backgroundColor: availablePlates.includes(weight.toString()) ? PLATE_COLORS[weight] : 'transparent',
                                            color: availablePlates.includes(weight.toString())
                                                ? (weight === 5 ? '#000' : '#fff')
                                                : 'inherit',
                                            borderColor: PLATE_COLORS[weight],
                                        }}
                                    >
                                        {weight}kg
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>

                        {/* Barbell Weight Input */}
                        <div className="space-y-2">
                            <Label htmlFor="barbell-weight-input">{t('plateCalculator.barbellWeight')}</Label>
                            <Input
                                id="barbell-weight-input"
                                type="number"
                                value={barbellWeight}
                                onChange={e => setBarbellWeight(e.target.value)}
                                placeholder="e.g., 20"
                            />
                        </div>

                        {/* Target Weight Input */}
                        <div className="space-y-2">
                            <Label htmlFor="weight-input">{t('plateCalculator.targetWeight')}</Label>
                            <Input
                                id="weight-input"
                                type="number"
                                value={targetWeight}
                                onChange={e => setTargetWeight(e.target.value)}
                                placeholder="e.g., 100"
                                autoFocus
                            />
                        </div>

                        {/* Visual Barbell */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-medium text-muted-foreground">{t('plateCalculator.barbellSetup')}</h3>
                                {totalCalculatedWeight > 20 && (
                                    <span className="text-sm font-semibold">
                                        {t('plateCalculator.total')}: {totalCalculatedWeight}kg
                                    </span>
                                )}
                            </div>

                            <div className="min-h-[120px] rounded-lg bg-muted/50 p-4">
                                {platesPerSide.length > 0 ? (
                                    <BarbellVisualization platesPerSide={platesPerSide} />
                                ) : (
                                    <div className="flex items-center justify-center h-[88px] text-muted-foreground text-sm">
                                        {t('plateCalculator.enterWeightHint', { weight: currentBarbellWeight })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plates Per Side List */}
                        {platesPerSide.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">{t('plateCalculator.platesPerSide')}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {platesPerSide.map(({ weight, count }) => (
                                        <div
                                            key={weight}
                                            className="flex items-center justify-between p-2 rounded-md border"
                                            style={{ borderColor: PLATE_COLORS[weight] + '40' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-4 h-4 rounded-sm border border-gray-600"
                                                    style={{ backgroundColor: PLATE_COLORS[weight] }}
                                                ></div>
                                                <span className="text-sm font-medium">{weight}kg</span>
                                            </div>
                                            <span className="text-sm text-muted-foreground">&times;{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Remaining Weight Warning */}
                        {remainingWeight > 0.01 && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <p className="text-sm text-destructive">
                                    ⚠️ {t('plateCalculator.remaining')}: {t('plateCalculator.remainingError', { weight: remainingWeight.toFixed(2) })}
                                </p>
                                <p className="text-xs text-destructive/80 mt-1">
                                    {t('plateCalculator.remainingHint')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}