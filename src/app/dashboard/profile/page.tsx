import GeneralSettingsCard from '@/components/dashboard/profile/GeneralSettingsCard';
import LoginSessionsCard from '@/components/dashboard/profile/LoginSessionsCard';
import TeamListCard from '@/components/dashboard/profile/TeamListCard';
import { Separator } from '@/components/ui/separator';
import { getSession } from '@/lib/utils/auth';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

export default async function ProfilePage() {
  const currentSessionCookie = cookies().get('session')!;

  const t = await getTranslations();
  const session = await getSession({
    user: {
      include: {
        sessions: true,
        teams: {
          where: {
            deletedAt: null,
          },
          include: {
            users: true,
          },
        },
      },
    },
  });

  const sessionsWithCurrent = session.user.sessions.map((session) => ({
    ...session,
    current: session.sessionId === currentSessionCookie?.value,
  }));

  const teamsWithOwner = session.user.teams.map((team) => ({
    ...team,
    isOwner: team.ownerId === session.user.id,
  }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('general.profile')}</h1>
        <Separator className="mt-2" />
      </div>
      <div className="mt-6 flex flex-col gap-6">
        <GeneralSettingsCard user={session.user} />
        <LoginSessionsCard sessions={sessionsWithCurrent} />
        <TeamListCard teams={teamsWithOwner} />
      </div>
    </>
  );
}
