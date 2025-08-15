import { useAccountSelector } from "@/components/AccountProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveTimer } from "@/hooks/useLiveTimer";
import {
    adjustRestTimer,
    clearRestTimer,
    resetRestTimer,
    togglePauseRestTimer,
    useRestTimer,
    type SessionWithRelations
} from "@/jazz/db";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { Duration } from "luxon";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";

export const AnimatedTime = ({ timeString, className }: { timeString: string; className?: string }) => {
    return (
        <div className={className}>
            <AnimatePresence mode="popLayout">
                {timeString.split("").map((char, index) => (
                    <motion.span
                        key={`${char}-${index}`}
                        className="inline-block"
                        initial={{ y: 12, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -12, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 35, duration: 0.4 }}
                    >
                        {char}
                    </motion.span>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default function RestTimer() {
    // 1. Get the reactive Jazz CoValue
    const restTimer = useRestTimer();

    
    const { displayTime, remainingPercentage, timeLeftMs } = useLiveTimer(restTimer);

    
    const hasShownToastRef = useRef(false);

    
    const activeSession = useAccountSelector({
        select: (me) => me.root?.sessions?.find(s => s && !s.completedAt)
    });
    const navigate = useNavigate();
    const { t } = useTranslation();

    
    useEffect(() => {
        if (restTimer && timeLeftMs <= 0 && !restTimer.isPaused && !hasShownToastRef.current) {
            toast.info(t('timer.restPeriodOver'));
            hasShownToastRef.current = true;
        }
        
        if (restTimer && timeLeftMs > 0) {
            hasShownToastRef.current = false;
        }
    }, [restTimer, timeLeftMs, t]);

    const handleNavigateToSession = () => {
        if (activeSession) {
            navigate(`/session/${activeSession.$jazz.id}`);
        }
    };

    return (
        <AnimatePresence>
            {restTimer && (
                <motion.div
                    key={restTimer.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                        className="relative h-16 w-[380px] overflow-hidden rounded-full border-2 border-input bg-background/20 backdrop-blur-md shadow-lg pointer-events-auto"
                    >
                        {}
                        <div className="absolute inset-0 bg-muted/10" />

                        {}
                        <motion.div
                            className="absolute inset-0 bg-accent/30 origin-right backdrop-blur-sm"
                            animate={{ scaleX: remainingPercentage / 100 }}
                            transition={{ duration: 0.1, ease: 'linear' }}
                        />

                        {}
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border/60" />

                        {}
                        <motion.div
                            className="absolute top-0 bottom-0 w-0.5 bg-border/60"
                            animate={{
                                left: `${100 - remainingPercentage}%`,
                                opacity: remainingPercentage > 0 ? 1 : 0
                            }}
                            transition={{ duration: 0.1, ease: 'linear' }}
                        />

                        {}
                        <div className="relative h-full flex items-center justify-between px-6 text-foreground">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            onClick={handleNavigateToSession}
                                            className={activeSession ? "cursor-pointer" : ""}
                                        >
                                            <AnimatedTime
                                                timeString={displayTime}
                                                className="text-4xl font-bold font-mono tracking-tighter tabular-nums drop-shadow-sm"
                                            />
                                        </div>
                                    </TooltipTrigger>
                                    {activeSession && (
                                        <TooltipContent>
                                            <p>{t('timer.returnToWorkout')}</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                            <div className="flex items-center">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => adjustRestTimer(-15)}>
                                                <Minus className="size-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('timer.subtractSeconds')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => adjustRestTimer(15)}>
                                                <Plus className="size-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('timer.addSeconds')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => togglePauseRestTimer()}>
                                                {restTimer.isPaused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{restTimer.isPaused ? t('timer.resumeTimer') : t('timer.pauseTimer')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => resetRestTimer()}>
                                                <RotateCcw className="size-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('timer.resetTimer')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => clearRestTimer()}>
                                                <X className="size-5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{t('timer.closeTimer')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const formatElapsedTime = (ms: number) => {
    const duration = Duration.fromMillis(Math.max(0, ms));
    if (duration.as('hours') >= 1) return duration.toFormat('h:mm:ss');
    return duration.toFormat('mm:ss');
};

export const WorkoutTimer = ({ session, className }: { session: SessionWithRelations, className?: string }) => {
    const [elapsedTime, setElapsedTime] = useState(Date.now() - new Date(session.startTime).getTime());

    useEffect(() => {
        const intervalId = setInterval(() => {
            setElapsedTime(Date.now() - new Date(session.startTime).getTime());
        }, 1000);
        return () => clearInterval(intervalId);
    }, [session.startTime]);

    return <AnimatedTime timeString={formatElapsedTime(elapsedTime)} className={className} />;
};