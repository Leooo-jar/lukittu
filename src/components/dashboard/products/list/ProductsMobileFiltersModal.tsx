import LoadingButton from '@/components/shared/LoadingButton';
import { Input } from '@/components/ui/input';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ProductsMobileFiltersModalProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  onOpenChange: (boolean: boolean) => void;
}

export default function ProductsMobileFiltersModal({
  open,
  search,
  setSearch,
  onOpenChange,
}: ProductsMobileFiltersModalProps) {
  const t = useTranslations();

  const [tempSearch, setTempSearch] = useState(search);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  const handleApply = () => {
    setSearch(tempSearch);
    handleOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[625px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t('general.filters')}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="flex flex-col gap-4 max-md:px-2">
          <div className="relative flex w-full items-center max-lg:w-full">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              className="wf pl-8"
              placeholder={t('dashboard.licenses.search_product')}
              value={tempSearch}
              onChange={(e) => {
                setTempSearch(e.target.value);
              }}
            />
          </div>
        </div>
        <ResponsiveDialogFooter>
          <div>
            <LoadingButton className="w-full" variant="outline">
              {t('general.close')}
            </LoadingButton>
          </div>
          <div>
            <LoadingButton className="w-full" onClick={handleApply}>
              {t('general.apply')}
            </LoadingButton>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
