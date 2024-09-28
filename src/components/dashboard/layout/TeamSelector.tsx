'use client';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/tailwind-helpers';
import { TeamContext } from '@/providers/TeamProvider';
import { Team } from '@prisma/client';
import { CommandList } from 'cmdk';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContext, useState } from 'react';
import SetTeamModal from './SetTeamModal';

interface TeamSelectorProps {
  fullWidth?: boolean;
}

export function TeamSelector({ fullWidth }: TeamSelectorProps) {
  const t = useTranslations();
  const ctx = useContext(TeamContext);
  const [open, setOpen] = useState(false);
  const [createTeamModalOpen, setTeamModalOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);

  return (
    <>
      <SetTeamModal
        open={createTeamModalOpen}
        teamToEdit={teamToEdit}
        onOpenChange={(boolean) => {
          setTeamModalOpen(boolean);
          if (!boolean) {
            setTeamToEdit(null);
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className={cn('w-[200px] justify-between', fullWidth && 'w-full')}
            role="combobox"
            variant="ghost"
          >
            {ctx.loading ? (
              <Skeleton className="h-4 w-full" />
            ) : ctx.selectedTeam ? (
              <span className="truncate">
                {
                  ctx.teams.find(
                    (team) => team.id.toString() === ctx.selectedTeam,
                  )?.name
                }
              </span>
            ) : (
              t('general.select_team')
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'popover-content-width-full w-[200px] p-0',
            fullWidth && 'w-full',
          )}
        >
          <Command
            filter={(value, search) => {
              const item = ctx.teams.find(
                (team) => team.id.toString() === value,
              );

              return item?.name.toLowerCase().includes(search.toLowerCase())
                ? 1
                : 0;
            }}
          >
            <CommandInput placeholder={t('general.search_team')} />
            <CommandList>
              <CommandEmpty className="px-4 py-4 text-sm">
                {t('general.no_team_found')}
              </CommandEmpty>
              {Boolean(ctx.teams.length) && (
                <CommandGroup>
                  <ScrollArea className="flex max-h-40 flex-col overflow-y-auto">
                    {ctx.teams.map((team) => (
                      <CommandItem
                        key={team.id}
                        value={team.id.toString()}
                        onSelect={(currentValue) => {
                          setOpen(false);
                          ctx.selectTeam(currentValue);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            ctx.selectedTeam === team.id.toString()
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        <span className="line-clamp-2">{team.name}</span>
                        {team.id.toString() === ctx.selectedTeam && (
                          <Button
                            className="ml-auto h-5 text-xs text-foreground"
                            size="sm"
                            variant="link"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTeamToEdit(team);
                              setTeamModalOpen(true);
                            }}
                          >
                            {t('general.edit')}
                          </Button>
                        )}
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              )}
              <Button
                className="w-full rounded-none border-x-0 border-b-0 border-t"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTeamModalOpen(true);
                  setTeamToEdit(null);
                }}
              >
                <Users className="mr-2 h-4 w-4 shrink-0" />
                {t('dashboard.teams.create_team')}
              </Button>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
