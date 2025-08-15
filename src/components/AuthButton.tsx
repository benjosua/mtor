import { useAccountSelector } from "@/components/AccountProvider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkoutAppAccount } from "@/jazz/schema";
import { useAccount, useIsAuthenticated } from "jazz-tools/react";
import { LogIn, LogOut, Settings, UserRoundCog } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AuthDialog } from "./AuthDialog";

export function AuthButton() {
    const { t } = useTranslation();
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
    const { logOut } = useAccount(WorkoutAppAccount);

    const profileName = useAccountSelector({
        select: (me) => me.profile?.name
    });

    const isAuthenticated = useIsAuthenticated();

    const handleLogOut = () => {
        logOut();
        toast.success(t('auth.loggedOut', 'You have been logged out.'));
    };

    if (isAuthenticated && profileName) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full">
                        <UserRoundCog className="h-[1.2rem] w-[1.2rem]" />
                        <span className="sr-only">{t('auth.userMenu')}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                        {profileName}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>{t('common.settings')}</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{t('auth.logOut')}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <>
            <Button onClick={() => setIsAuthDialogOpen(true)}>
                <LogIn className="mr-2 h-4 w-4" />
                {t('auth.signUpOrLogIn')}
            </Button>
            <AuthDialog
                isOpen={isAuthDialogOpen}
                onOpenChange={setIsAuthDialogOpen}
            />
        </>
    );
}