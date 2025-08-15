import { useDialog } from '@/components/DialogProvider';
import { DurationEditor } from '@/components/DurationEditor';
import { ExerciseList } from '@/components/ExerciseList';
import { WorkoutTimer } from '@/components/RestTimer';
import { Button } from '@/components/ui/button';
import { WorkoutSummary } from '@/components/WorkoutSummary';
import {
    clearRestTimer,
    deleteSession,
    endCurrentWorkout,
    endCurrentWorkoutWithEndTime,
    useSession,
} from '@/jazz/db';
import { Ban, BookmarkCheck, CalendarCheck } from 'lucide-react';
import { DateTime } from 'luxon';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const SessionPage = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const { confirm } = useDialog();
    const { t } = useTranslation();
    const adjustedDurationRef = useRef<number | null>(null);

    const { session } = useSession(uuid);

    const isCurrentWorkout = session && !session.completedAt;

    const handleFinishWorkout = () => {
        if (!session) return;

        const durationMs = Date.now() - new Date(session.startTime).getTime();
        const ONE_HOUR_MS = 3600 * 1000;

        if (isCurrentWorkout && durationMs > ONE_HOUR_MS) {
            adjustedDurationRef.current = durationMs;

            confirm({
                title: t('session.confirmDurationTitle'),
                description: (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {t('session.confirmDurationDescription')}
                        </p>
                        <DurationEditor
                            initialDurationMs={durationMs}
                            onDurationChange={(newDuration) => {
                                adjustedDurationRef.current = newDuration;
                            }}
                        />
                    </>
                ),
                confirmText: t('session.saveAndFinish'),
                onConfirm: () => {
                    const finalDuration = adjustedDurationRef.current ?? durationMs;
                    const newEndTime = new Date(
                        new Date(session.startTime).getTime() + finalDuration,
                    );
                    endCurrentWorkoutWithEndTime(session, newEndTime);
                    toast.success(t('session.workoutComplete', 'Workout complete! Well done.'));
                },
            });
        } else {
            confirm({
                title: t('session.finishWorkoutTitle'),
                description: t('session.finishWorkoutDescription'),
                onConfirm: () => {
                    endCurrentWorkout(session);
                    toast.success(t('session.workoutComplete', 'Workout complete! Well done.'));
                },
            });
        }
    };

    const handleCancelWorkout = () => {
        if (!session) return;
        confirm({
            title: t('session.cancelWorkoutTitle'),
            description: t('session.cancelWorkoutDescription'),
            confirmText: t('session.yesCancel'),
            onConfirm: () => {
                clearRestTimer();
                deleteSession(session.$jazz.id);
                toast.warning(t('session.workoutCanceled', 'Workout canceled.'));
                navigate('/');
            },
        });
    };

    if (session === undefined) {
        return <div className="text-center mt-10">{t('common.loading')}</div>;
    }

    if (session === null) {
        return (
            <div className="text-center mt-10">
                <h1 className="text-2xl font-bold">{t('session.sessionNotFound')}</h1>
                <p className="text-muted-foreground">
                    {t('session.sessionNotFoundDescription')}
                </p>
                <Button onClick={() => navigate('/')} className="mt-4">
                    {t('session.goToDashboard')}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-25">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-ellipsis">{session.name}</h1>
                <div className="flex items-center gap-1.5">
                    {isCurrentWorkout ? (
                        <>
                            <Button variant="outline" onClick={handleCancelWorkout}>
                                <Ban className="size-4" />
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleFinishWorkout}
                            >
                                <BookmarkCheck className="size-4" />
                                {t('session.finish')}
                            </Button>
                        </>
                    ) : (
                        <Button asChild variant="outline">
                            <Link to="/">{t('session.backToDashboard')}</Link>
                        </Button>
                    )}
                </div>
            </div>
            <div className="text-primary">
                {session.completedAt ? (
                    <>

                        <CalendarCheck className="inline size-4 mr-1 -mt-0.5" />
                        {t('session.completed')} {(() => {
                            const dt = DateTime.fromISO(typeof session.completedAt === 'string' ? session.completedAt : session.completedAt.toISOString());
                            return `${dt.toRelative()} (${dt.setLocale(i18n.language).toLocaleString(DateTime.DATE_FULL)})`;
                        })()}
                    </>
                ) : (
                    <div className="text-2xl font-semibold text-muted-foreground">
                        <WorkoutTimer
                            session={session}
                            className="font-mono tracking-tighter"
                        />
                    </div>
                )}
            </div>

            {session.completedAt && <WorkoutSummary session={session} />}

            <ExerciseList session={session} />
        </div >
    );
};

export default SessionPage;