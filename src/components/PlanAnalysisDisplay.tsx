import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MuscleGroupAnalysis, PlanAnalysis } from "@/lib/planAnalyzer";
import { stretchMediatedHypertrophyMuscles } from "@/lib/muscleUtils";
import { cn } from "@/lib/utils";
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Info } from "lucide-react";

interface PlanAnalysisDisplayProps {
    analysis: PlanAnalysis | null;
    t: TFunction;
}

const SuggestionIcon = ({ level }: { level: MuscleGroupAnalysis['suggestionLevel'] }) => {
    switch (level) {
        case 'good': return <CircleCheck className="size-4 text-green-500 flex-shrink-0" />;
        case 'info': return <Info className="size-4 text-blue-500 flex-shrink-0" />;
        case 'warning': return <CircleAlert className="size-4 text-amber-500 flex-shrink-0" />;
        default: return <Info className="size-4 flex-shrink-0" />;
    }
};

const VolumeBar = ({ primary, secondaryWeighted, total }: { primary: number; secondaryWeighted: number; total: number; }) => {
    
    const primaryPercent = total > 0 ? (primary / total) * 100 : 0;
    const secondaryPercent = total > 0 ? (secondaryWeighted / total) * 100 : 0;
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="w-full h-1.5 rounded-full bg-muted flex overflow-hidden">
                        <div className="bg-primary" style={{ width: `${primaryPercent}%` }}></div>
                        <div className="bg-secondary" style={{ width: `${secondaryPercent}%` }}></div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Primary Sets: {primary}</p>
                    <p>Secondary (Weighted) Sets: {secondaryWeighted}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const SmhHint = ({ className }: { className?: string }) => {
    const { t } = useTranslation();
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="secondary" className={cn("ml-1 text-[10px] px-1 py-0 cursor-pointer", className)}>SMH</Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t('exercise.smhHint')}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export const PlanAnalysisDisplay = ({ analysis, t }: PlanAnalysisDisplayProps) => {
    if (!analysis || Object.keys(analysis).length === 0) {
        return null;
    }

    const sortedAnalysis = Object.entries(analysis).sort(([, a], [, b]) => b.totalWeeklySets - a.totalWeeklySets);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Plan Analysis</CardTitle>
                <CardDescription>
                    A summary of weekly volume, frequency, and recovery based on current exercise science.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-hidden">
                    {}
                    <div className="flex items-center p-2 border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                        <div className="flex-1 pl-1">Muscle Group & Targets</div>
                        <div className="w-32 text-center">Weekly Sets</div>
                        <div className="w-24 text-center">Frequency</div>
                    </div>
                    {/* Table Body */}
                    <div className="divide-y">
                        {sortedAnalysis.map(([group, data]) => (
                            <div key={group} className="p-2.5">
                                {/* Stats Row */}
                                <div className="flex items-start text-sm">
                                    <div className="flex-1 pr-2">
                                        <h4 className="font-semibold capitalize">{t(`generalMuscles.${group}`)}</h4>
                                        {(data.specificPrimary.length > 0 || data.specificSecondary.length > 0) && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {data.specificPrimary.map(muscle => (
                                                    <Badge key={muscle} variant="outline" className="text-xs capitalize px-1.5 py-0 leading-relaxed flex items-center">
                                                        {t(`muscles.${muscle}`)}
                                                        {stretchMediatedHypertrophyMuscles.has(muscle) && <SmhHint />}
                                                    </Badge>
                                                ))}
                                                {data.specificSecondary.map(muscle => (
                                                    <Badge key={muscle} variant="secondary" className="text-xs capitalize px-1.5 py-0 leading-relaxed">{t(`muscles.${muscle}`)}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-32 text-center">
                                        <span className="font-mono text-xl font-medium leading-none">{data.totalWeeklySets}</span>
                                        <VolumeBar primary={data.primarySets} secondaryWeighted={data.secondarySetsWeighted} total={data.totalWeeklySets} />
                                        <span className="text-xs text-muted-foreground font-mono">
                                            (P:{data.primarySets} S:{data.secondarySetsUnweighted})
                                        </span>
                                    </div>
                                    <div className="w-24 text-center">
                                        <span className="font-mono text-xl font-medium leading-none">{data.frequency}x</span>
                                        <p className="text-xs text-muted-foreground mt-1.5">{data.frequency > 1 ? 'per week' : 'per week'}</p>
                                    </div>
                                </div>
                                {/* Insight Row */}
                                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-dashed">
                                    <SuggestionIcon level={data.suggestionLevel} />
                                    <p className="text-xs text-muted-foreground flex-1">{data.suggestion}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};