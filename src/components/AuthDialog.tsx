import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasskeyAuth } from "jazz-tools/react";
import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { toast } from "sonner";

interface AuthDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const APPLICATION_NAME = "mTOR";

export function AuthDialog({ isOpen, onOpenChange }: AuthDialogProps) {
    const { t } = useTranslation();
    const [isSignUp, setIsSignUp] = useState(true);
    const [username, setUsername] = useState("");
    const [error, setError] = useState<string | null>(null);

    const auth = usePasskeyAuth({ appName: APPLICATION_NAME });

    const handleViewChange = () => {
        setIsSignUp(!isSignUp);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            if (isSignUp) {
                if (!username.trim()) {
                    setError(t('auth.usernameRequiredError'));
                    return;
                }
                await auth.signUp(username);
                toast.success(t('auth.accountCreatedSuccess', 'Account created successfully!'));
            } else {
                await auth.logIn();
                toast.success(t('auth.welcomeBack', 'Welcome back!'));
            }
            onOpenChange(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            console.error(err);
            toast.error(errorMessage);
            setError(errorMessage);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {isSignUp ? t('auth.createAccount') : t('auth.welcomeBack')}
                    </DialogTitle>
                    <DialogDescription>
                        {isSignUp
                            ? t('auth.signUpDescription')
                            : t('auth.logInDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignUp && (
                        <div className="space-y-2">
                            <Label htmlFor="username">{t('auth.username')}</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={t('auth.chooseUsernamePlaceholder')}
                                required
                                autoFocus
                            />
                        </div>
                    )}
                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div className="flex flex-col gap-2">
                        <Button type="submit" className="w-full">
                            {isSignUp ? t('auth.signUpButton') : t('auth.logInButton')}
                        </Button>
                        <Button type="button" variant="link" onClick={handleViewChange}>
                            {isSignUp
                                ? t('auth.alreadyHaveAccount')
                                : t('auth.needAnAccount')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}