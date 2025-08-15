import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useMatches,
  useParams,
  type UIMatch
} from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useMemo } from 'react';
import RestTimer from './components/RestTimer';
import { Toaster } from './components/ui/sonner';
import { useResolvedExerciseDetails } from './hooks/useResolvedExercise';
import { usePlan, useSession } from './jazz/db';
import CustomExercisesPage from './pages/CustomExercisesPage';
import DashboardPage from './pages/DashboardPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import PlanEditPage from './pages/PlanEditPage';
import PlanSharePage from './pages/PlanSharePage';
import SessionPage from './pages/SessionPage';
import SettingsPage from './pages/SettingsPage';

const PlanBreadcrumb = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { plan } = usePlan(uuid);
  return <>{plan?.name || '...'}</>;
};

const SessionBreadcrumb = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { session } = useSession(uuid);
  return <>{session?.name || '...'}</>
};

const ExerciseBreadcrumb = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const mockExercise = useMemo(() => (templateId ? { templateId } : null), [templateId]);
  const resolvedDetails = useResolvedExerciseDetails(mockExercise);
  return <>{resolvedDetails?.name || '...'}</>;
};

const RootLayout = () => {
  const matches = useMatches();

  const crumbs = matches
    .filter(
      (match): match is UIMatch<unknown, { breadcrumb: React.ReactNode }> =>
        Boolean((match.handle as { breadcrumb?: React.ReactNode })?.breadcrumb),
    )
    .map((match) => ({
      to: match.pathname,
      label: match.handle.breadcrumb,
    }));

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <div className="p-4 sm:p-6 space-y-4 pb-24">
        <Breadcrumbs items={crumbs} />
        <main>
          <Outlet />
        </main>
      </div>
      <RestTimer />
      <Toaster />
    </div>
  );
};

const NotFoundPage = () => {
  const { t } = useTranslation();
  return <div className="text-3xl font-bold text-center mt-20">{t('app.notFound')}</div>;
};

const DashboardBreadcrumb = () => {
  const { t } = useTranslation();
  return <>{t('common.dashboard')}</>;
};

const SharedPlanBreadcrumb = () => {
  const { t } = useTranslation();
  return <>{t('app.sharedPlan')}</>;
};

const SettingsBreadcrumb = () => {
  const { t } = useTranslation();
  return <>{t('common.settings')}</>;
};

const CustomExercisesBreadcrumb = () => {
  const { t } = useTranslation();
  return <>{t('customExercises.pageTitle')}</>;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    handle: { breadcrumb: <DashboardBreadcrumb /> },
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'plans/:uuid', element: <PlanEditPage />, handle: { breadcrumb: <PlanBreadcrumb /> } },
      { path: 'session/:uuid', element: <SessionPage />, handle: { breadcrumb: <SessionBreadcrumb /> } },
      { path: 'exercises/:templateId', element: <ExerciseDetailPage />, handle: { breadcrumb: <ExerciseBreadcrumb /> } },
      { path: 'share/plan/:uuid', element: <PlanSharePage />, handle: { breadcrumb: <SharedPlanBreadcrumb /> } },
      { path: 'settings', element: <SettingsPage />, handle: { breadcrumb: <SettingsBreadcrumb /> } },
      { path: 'custom-exercises', element: <CustomExercisesPage />, handle: { breadcrumb: <CustomExercisesBreadcrumb /> } },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import React from 'react';

interface BreadcrumbItemData {
  to: string;
  label: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItemData[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => (
          <React.Fragment key={item.to}>
            <BreadcrumbItem>
              {index === items.length - 1 ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.to}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}