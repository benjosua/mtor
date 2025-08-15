import { useAccountSelector } from '@/components/AccountProvider';
import { AuthDialog } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { duplicatePlan, usePlan } from '@/jazz/db';
import { useIsAuthenticated } from 'jazz-tools/react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const PlanSharePage = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const { plan } = usePlan(uuid);
    const { t } = useTranslation();
    const isAuthenticated = useIsAuthenticated();
    const isAccountLoaded = useAccountSelector({
        select: (me) => !!me.root
    });

    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [copyComplete, setCopyComplete] = useState(false);
    const [copyIntent, setCopyIntent] = useState(false);

    const handleCopyPlan = useCallback(async () => {
        if (!plan) return;

        if (!isAuthenticated) {
            setCopyIntent(true);
            setIsAuthOpen(true);
            return;
        }

        setIsCopying(true);
        const newPlanId = await duplicatePlan(uuid!); 
        setIsCopying(false);

        if (newPlanId) {
            setCopyComplete(true);
            toast.success(t('planShare.planCopied', 'Plan copied to your account! Redirecting...'));
            setTimeout(() => {
                navigate(`/plans/${newPlanId}`);
            }, 1500);
        } else {
            toast.error(t('planShare.copyFailed', 'Failed to copy the plan. Please try again.'));
        }
    }, [plan, isAuthenticated, navigate, uuid]);

    
    useEffect(() => {
        
        
        
        
        
        if (isAuthenticated && copyIntent && plan && isAccountLoaded) {
            setCopyIntent(false); 
            handleCopyPlan(); 
        }
    }, [isAuthenticated, copyIntent, plan, isAccountLoaded, handleCopyPlan]);

    const renderContent = () => {
        if (plan === undefined) {
            return (
                <div className="text-center py-10">
                    <Loader2 className="size-8 animate-spin mx-auto" />
                    <p className="mt-2 text-muted-foreground">{t('planShare.loading')}</p>
                </div>
            );
        }

        if (plan === null) {
            return (
                <div className="text-center py-10">
                    <p className="font-semibold">{t('planShare.planNotFound')}</p>
                    <p className="text-muted-foreground mt-1">{t('planShare.planNotFoundDescription')}</p>
                </div>
            );
        }

        return (
            <>
                <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{t('planShare.inviteDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {plan.days?.map(day => (
                            day && <div key={day.$jazz.id} className="p-3 border rounded-md">
                                <h4 className="font-semibold">{day.name}</h4>
                                <p className="text-sm text-muted-foreground truncate">
                                    {(day.exercises || []).filter(Boolean).map(ex => ex?.name).join(' • ') || t('planShare.noExercises')}
                                </p>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleCopyPlan} className="w-full" disabled={isCopying || copyComplete}>
                        {isCopying && <Loader2 className="mr-2 size-4 animate-spin" />}
                        {copyComplete && <Check className="mr-2 size-4" />}
                        {isCopying ? t('planShare.copying') : copyComplete ? t('planShare.copied') : <> <Copy className="mr-2 size-4" /> {t('planShare.addToMyPlans')} </>}
                    </Button>
                </CardContent>
            </>
        );
    };

    return (
        <div className="mt-10">
            <Card>
                {renderContent()}
            </Card>
            <AuthDialog isOpen={isAuthOpen} onOpenChange={setIsAuthOpen} />
        </div>
    );
};

export default PlanSharePage;