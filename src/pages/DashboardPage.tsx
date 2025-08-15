import { useAccountSelector } from "@/components/AccountProvider";
import { AuthButton } from "@/components/AuthButton";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useDialog } from "@/components/DialogProvider";
import { ExerciseSearch } from "@/components/ExerciseSearch";
import { WorkoutTimer } from "@/components/RestTimer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ripple } from "@/components/ui/ripple";
import { useResolvedExerciseDetails } from "@/hooks/useResolvedExercise";
import {
    createPlan,
    createPlanFromSession,
    deletePlan,
    deleteSession,
    restartWorkout,
    setActivePlan,
    startQuickWorkout,
    startWorkoutFromPlanDay,
    type PlanDayWithRelations,
    type PlanWithRelations,
    type SessionWithRelations
} from "@/jazz/db";
import { cn } from "@/lib/utils";
import { useIsAuthenticated } from "jazz-tools/react";
import { Asterisk, BookOpen, CalendarDays, Check, ClipboardPlus, Clock, Copy, Ellipsis, FolderCog, Play, Trash2, X } from "lucide-react";
import { DateTime } from "luxon";
import React, { useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ResolvedExerciseName = ({ exercise }: { exercise: { name?: string | null; templateId?: string | null } }) => {
    const exerciseForHook = useMemo(() => (
        exercise && exercise.templateId ? { templateId: exercise.templateId } : null
    ), [exercise?.templateId]);

    const resolvedDetails = useResolvedExerciseDetails(exerciseForHook);
    const { t } = useTranslation();

    return <>{resolvedDetails?.name || exercise?.name || t('common.exercise')}</>;
};

const ExerciseListSummary = ({ exercises, emptyText }: { exercises: ({ id: string, name?: string | null, templateId?: string | null }[] | undefined | null), emptyText: string }) => {
    const filteredExercises = exercises?.filter(Boolean) ?? [];

    if (filteredExercises.length === 0) {
        return <>{emptyText}</>;
    }

    return (
        <>
            {filteredExercises.map((exercise, index) => (
                <React.Fragment key={exercise.id}>
                    <ResolvedExerciseName exercise={exercise} />
                    {index < filteredExercises.length - 1 && ' • '}
                </React.Fragment>
            ))}
        </>
    );
};

const DashboardPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const { confirm } = useDialog();

    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const { plans, allSessions, profileName } = useAccountSelector({
        select: (me) => ({
            plans: me.root?.plans,
            allSessions: me.root?.sessions,
            profileName: me.profile?.name || '',
        })
    });

    const isAuthenticated = useIsAuthenticated();

    const activeSession = useMemo(() => allSessions?.find(s => s && !s.completedAt), [allSessions]);
    const activePlan = useMemo(() => plans?.find(p => p && p.isActive), [plans]);

    const completedSessions = useMemo(() => {
        return allSessions
            ?.filter((s): s is SessionWithRelations => !!s?.completedAt)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
            ?? [];
    }, [allSessions]);

    const workoutDays = useMemo(() => {
        return completedSessions.map(s => s.completedAt ? new Date(s.completedAt) : new Date());
    }, [completedSessions]);

    const sessionsOnSelectedDay = useMemo(() => {
        if (!selectedDate) return [];
        return completedSessions.filter(s =>
            s.completedAt && new Date(s.completedAt).toDateString() === selectedDate.toDateString()
        );
    }, [completedSessions, selectedDate]);

    
    const sessionsToDisplay = selectedDate ? sessionsOnSelectedDay : completedSessions;

    const activePlanCycleStatus = useMemo(() => {
        if (!activePlan || !activePlan.days?.length) return null;

        const activePlanSessions = completedSessions.filter(s => s.planId === activePlan.$jazz.id);
        const sortedDays = [...activePlan.days].filter((d): d is NonNullable<typeof d> => !!d).sort((a, b) => a.order - b.order);
        const firstDay = sortedDays[0];

        if (!firstDay) return null;

        const lastCycleStartIndex = activePlanSessions.findIndex(s => s.dayId === firstDay.$jazz.id);

        const sessionsInCurrentCycle = lastCycleStartIndex === -1
            ? activePlanSessions
            : activePlanSessions.slice(0, lastCycleStartIndex + 1);

        const completedDayIds = new Set(sessionsInCurrentCycle.map(s => s.dayId).filter(Boolean));
        let nextDay = sortedDays.find(d => !completedDayIds.has(d.$jazz.id));

        if (!nextDay && sortedDays.length > 0) {
            nextDay = firstDay;
        }

        return { completedDayIds, nextDayId: nextDay?.$jazz.id ?? null, completedCount: completedDayIds.size, totalCount: activePlan.days.length };
    }, [activePlan, completedSessions]);

    const { nextDay, nextPlan } = useMemo(() => {
        if (activeSession || !activePlan || !activePlanCycleStatus?.nextDayId) {
            return { nextDay: null, nextPlan: null };
        }
        const day = activePlan.days?.find(d => d?.$jazz.id === activePlanCycleStatus.nextDayId);
        return { nextDay: day || null, nextPlan: activePlan };
    }, [activeSession, activePlan, activePlanCycleStatus]);

    const handleCreateNewPlan = async () => {
        const newPlanId = await createPlan();
        navigate(`/plans/${newPlanId}`);
    };
    const handleStartWorkout = async (plan: PlanWithRelations, dayId: string) => {
        const newSessionId = await startWorkoutFromPlanDay(plan, dayId);
        if (newSessionId) {
            navigate(`/session/${newSessionId}`);
        }
    };
    const handleQuickStart = async () => {
        const newSessionId = await startQuickWorkout();
        if (newSessionId) {
            navigate(`/session/${newSessionId}`);
        }
    };
    const handleDeletePlan = (plan: PlanWithRelations) => {
        confirm({
            title: t('dashboard.deletePlanTitle', { planName: plan.name }), description: t('dashboard.deletePlanDescription'), confirmText: t('common.delete'), onConfirm: () => {
                deletePlan(plan.$jazz.id);
                toast.success(t('dashboard.planDeleted', `Plan "${plan.name}" deleted.`));
            }
        });
    };

    const handleSelectExerciseForDetail = (exerciseId: string) => {
        navigate(`/exercises/${exerciseId}`);
        setIsLibraryOpen(false);
    };

    const handleDeleteSession = (session: SessionWithRelations) => {
        confirm({
            title: t('dashboard.deleteSessionTitle', { sessionName: session.name }),
            description: t('dashboard.deleteSessionDescription'),
            confirmText: t('common.delete'),
            onConfirm: () => {
                deleteSession(session.$jazz.id);
                toast.success(t('dashboard.sessionDeleted', 'Workout session deleted.'));
            }
        });
    };

    const handleRestartWorkout = async (session: SessionWithRelations) => {
        if (activeSession) {
            confirm({
                title: t('dashboard.workoutInProgress'),
                description: t('dashboard.cannotStartNewWorkout'),
                confirmText: t('common.ok'),
                onConfirm: () => { }
            });
            return;
        }
        const newSessionId = await restartWorkout(session);
        if (newSessionId) {
            navigate(`/session/${newSessionId}`);
        }
    };

    const handleCreatePlanFromSession = async (session: SessionWithRelations) => {
        const newPlanId = await createPlanFromSession(session);
        if (newPlanId) {
            navigate(`/plans/${newPlanId}`);
            toast.success(t('dashboard.planCreatedFromSession', 'Plan created from session.'));
        }
    };

    if (!plans && !allSessions) {
        return <div className="text-center mt-10">{t('common.loading')}</div>
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('common.dashboard')}</h1>
                    <p className="text-muted-foreground">
                        {isAuthenticated && profileName ? t('dashboard.welcomeBack', { name: profileName }) : t('dashboard.overviewToday')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <ConnectionStatus />
                    <AuthButton />
                </div>
            </header>
            {activeSession ? (
                <Card className="relative overflow-hidden border-primary/30">
                    <Ripple className="[mask-image:radial-gradient(ellipse_at_center,white_60%,transparent_100%)]" />
                    <CardContent className="relative z-10 flex flex-col sm:flex-row items-center gap-4 p-4">
                        <div className="sm:flex-1">
                            <p className="font-semibold text-base md:text-lg truncate text-center sm:text-left">
                                {activeSession.name}
                            </p>
                        </div>

                        <WorkoutTimer
                            session={activeSession}
                            className="font-mono font-bold text-3xl tracking-tighter shrink-0"
                        />

                        <div className="sm:flex-1 flex justify-center sm:justify-end">
                            <Button asChild size="sm" className="shrink-0">
                                <Link to={`/session/${activeSession.$jazz.id}`}>
                                    <Play className="mr-2 size-4" />
                                    {t('dashboard.resume')}
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (nextDay && nextPlan) && (
                <Card className="border-primary/30">
                    <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                                <p className="text-sm text-muted-foreground">{t('dashboard.nextUp')} <span className="font-semibold text-foreground truncate">{nextPlan.name}</span></p>
                                <p className="font-semibold text-base md:text-lg truncate">{nextDay.name}</p>
                            </div>
                        </div>
                        <Button onClick={() => handleStartWorkout(nextPlan, nextDay.$jazz.id)} size="sm">
                            <Play className="mr-2 size-4" />
                            {t('dashboard.start')}
                        </Button>
                    </CardContent>
                </Card>
            )}
            <Accordion type="single" collapsible className="w-full" defaultValue="quick-actions"><AccordionItem value="quick-actions"><AccordionTrigger className="font-semibold">{t('dashboard.quickActions')}</AccordionTrigger><AccordionContent><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <Button variant="outline" size="lg" className="flex items-center justify-start gap-4" onClick={handleQuickStart} disabled={!!activeSession}><Asterisk className="size-5" /><span>{t('dashboard.quickStart')}</span></Button>
                <Button variant="outline" size="lg" className="flex items-center justify-start gap-4" onClick={() => setIsLibraryOpen(true)}><BookOpen className="size-5" /><span>{t('dashboard.exerciseLibrary')}</span></Button>
                <Button variant="outline" size="lg" className="flex items-center justify-start gap-4" onClick={handleCreateNewPlan}><ClipboardPlus className="size-5" /><span>{t('dashboard.newPlan')}</span></Button>
                <Button asChild variant="outline" size="lg" className="flex items-center justify-start gap-4">
                    <Link to="/settings"><FolderCog className="size-5" /><span>{t('common.settings')}</span></Link>
                </Button>
            </div></AccordionContent></AccordionItem></Accordion>

            <Card><CardHeader><CardTitle>{t('dashboard.yourPlans')}</CardTitle><CardDescription>{t('dashboard.managePlans')}</CardDescription></CardHeader><CardContent>
                {!plans || plans.length === 0 ? (<Empty className="py-10 border-2 border-dashed rounded-lg">
                    <EmptyHeader>
                        <EmptyMedia variant="icon"><ClipboardPlus /></EmptyMedia>
                        <EmptyTitle>{t('dashboard.noPlansYet')}</EmptyTitle>
                        <EmptyDescription>{t('dashboard.noPlansDescription')}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={handleCreateNewPlan}>{t('dashboard.createFirstPlan')}</Button>
                    </EmptyContent>
                </Empty>) : (<Accordion type="single" collapsible className="w-full" defaultValue={activePlan?.$jazz.id ?? (plans && plans.length > 0 ? plans[plans.length - 1]?.$jazz.id : undefined)}>
                    {plans.map((plan) => plan && (
                        <AccordionItem value={plan.$jazz.id} key={plan.$jazz.id}>
                            <div className="flex items-center gap-2">
                                <AccordionTrigger className="font-semibold hover:no-underline flex-1">
                                    <div className="flex items-center gap-4">
                                        <span>{plan.name}</span>
                                        {plan.isActive && <Badge>{t('dashboard.active')}</Badge>}
                                    </div>
                                </AccordionTrigger>
                                <Button asChild variant="outline" size="sm" className="shrink-0">
                                    <Link to={`/plans/${plan.$jazz.id}`}>{t('dashboard.editPlan')}</Link>
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="shrink-0">
                                            <Ellipsis className="size-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => {
                                            setActivePlan(plan.$jazz.id);
                                            toast.success(t('dashboard.planSetAsActive', `"${plan.name}" is now the active plan.`));
                                        }} disabled={plan.isActive}>
                                            {t('dashboard.setAsActive')}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeletePlan(plan)}>
                                            {t('dashboard.deletePlan')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <AccordionContent>
                                {plan.isActive && activePlanCycleStatus && plan.days && plan.days.length > 0 && (
                                    <div className="text-sm text-muted-foreground mb-3 px-1">
                                        {t('dashboard.currentCycle')} {t('dashboard.cycleCompleted', { completed: activePlanCycleStatus.completedCount, total: activePlanCycleStatus.totalCount })}
                                    </div>
                                )}
                                <div className="flex flex-col gap-3">
                                    {plan.days?.map((day: PlanDayWithRelations) => {
                                        if (!day) return null;
                                        const isCompletedInCycle = plan.isActive && activePlanCycleStatus?.completedDayIds.has(day.$jazz.id);
                                        const isNext = plan.isActive && activePlanCycleStatus?.nextDayId === day.$jazz.id;
                                        return (
                                            <div key={day.$jazz.id} className={`flex items-center justify-between gap-4 p-3 rounded-lg transition-colors ${isNext && !isCompletedInCycle ? 'bg-primary/10' : ''} ${isCompletedInCycle ? 'bg-muted/40' : 'hover:bg-muted/50'}`}>
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`flex size-6 shrink-0 items-center justify-center rounded-full font-bold text-xs mt-1 ${isCompletedInCycle ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                        {isCompletedInCycle ? <Check className="size-4" /> : day.order + 1}
                                                    </div>
                                                    <div className={`flex flex-col ${isCompletedInCycle ? 'text-muted-foreground' : ''}`}>
                                                        <p className={`font-semibold text-sm ${isCompletedInCycle ? 'line-through' : ''}`}>{day.name}</p>
                                                        <p className="text-xs">
                                                            <ExerciseListSummary
                                                                exercises={day.exercises?.filter(ex => ex != null).map(ex => ({
                                                                    id: ex.$jazz.id,
                                                                    name: ex.name,
                                                                    templateId: ex.templateId
                                                                })) || []}
                                                                emptyText={t('dashboard.noExercisesYet')}
                                                            />
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={isNext && (!isCompletedInCycle || activePlanCycleStatus?.nextDayId === day.$jazz.id) ? "default" : "outline"}
                                                    onClick={() => handleStartWorkout(plan, day.$jazz.id)}
                                                    disabled={!!activeSession || (isCompletedInCycle && activePlanCycleStatus?.nextDayId !== day.$jazz.id)}
                                                    className="shrink-0"
                                                >
                                                    {isCompletedInCycle && activePlanCycleStatus?.nextDayId !== day.$jazz.id ? (
                                                        <>
                                                            <Check className="size-4 mr-2" />
                                                            {t('common.done')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="size-4 mr-2" />
                                                            {t('dashboard.start')}
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )
                                    })}
                                    {plan.days && plan.days.length === 0 && (
                                        <p className="text-sm text-center text-muted-foreground py-4">
                                            {t('dashboard.planHasNoDays')} <Link to={`/plans/${plan.$jazz.id}`} className="font-semibold text-primary underline">{t('dashboard.addOneNow')}</Link>.
                                        </p>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>)}
            </CardContent></Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard.workoutHistory')}</CardTitle>
                    <CardDescription>{t('dashboard.reviewPastWorkouts')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !selectedDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarDays className="mr-2 size-4" />
                                        {selectedDate ? (
                                            DateTime.fromJSDate(selectedDate).setLocale(i18n.language).toLocaleString(DateTime.DATE_FULL)
                                        ) : (
                                            <span>{t('dashboard.pickADate')}</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) => {
                                            setSelectedDate(date)
                                            setIsDatePickerOpen(false)
                                        }}
                                        modifiers={{ workout: workoutDays }}
                                        modifiersClassNames={{
                                            workout: "[&>button]:border-2 [&>button]:border-dashed [&>button]:border-primary/50",
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        {selectedDate && (
                            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(undefined)} className="h-9 w-9 shrink-0">
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>

                    <div className="w-full">
                        {sessionsToDisplay.length > 0 ? (
                            <Accordion type="single" collapsible className="w-full">
                                {sessionsToDisplay.map(session => (
                                    <AccordionItem value={session.$jazz.id} key={session.$jazz.id}>
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex justify-between items-center w-full pr-4">
                                                <div>
                                                    <p className="font-semibold text-sm text-left">{session.name}</p>
                                                </div>
                                                <Button asChild variant="outline" size="sm">
                                                    <Link to={`/session/${session.$jazz.id}`}>{t('dashboard.view')}</Link>
                                                </Button>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        <Clock className="size-3 mr-1.5" />
                                                        {DateTime.fromJSDate(new Date(session.endTime!))
                                                            .diff(DateTime.fromJSDate(new Date(session.startTime)))
                                                            .shiftTo('hours', 'minutes', 'seconds')
                                                            .toHuman({
                                                                unitDisplay: 'short',
                                                                showZeros: false,
                                                                maximumFractionDigits: 0
                                                            })}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {session.exercises?.length || 0} {t('common.exercises')}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm">
                                                    <p className="text-muted-foreground text-xs">
                                                        <ExerciseListSummary
                                                            exercises={session.exercises?.filter(ex => ex != null).map(ex => ({
                                                                id: ex.$jazz.id,
                                                                name: ex.name,
                                                                templateId: ex.templateId
                                                            })) || []}
                                                            emptyText={t('dashboard.noExercisesYet')}
                                                        />
                                                    </p>
                                                </div>
                                                <div className="flex justify-end items-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                                                <Ellipsis className="size-5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleRestartWorkout(session)}>
                                                                <Play className="mr-2 size-4" />
                                                                <span>{t('dashboard.restartWorkout')}</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleCreatePlanFromSession(session)}>
                                                                <Copy className="mr-2 size-4" />
                                                                <span>{t('dashboard.saveAsPlan')}</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteSession(session)}>
                                                                <Trash2 className="mr-2 size-4" />
                                                                <span>{t('common.delete')}</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <Empty className="py-10">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                                    <EmptyTitle>
                                        {selectedDate ? t('dashboard.noHistoryOnDate') : t('dashboard.noHistoryYet')}
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        {selectedDate ? t('dashboard.noHistoryOnDate') : t('dashboard.noHistoryDescription')}
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </div>
                </CardContent>
            </Card>

            <ExerciseSearch isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onSelectExercise={handleSelectExerciseForDetail} />
        </div>
    );
}

export default DashboardPage;