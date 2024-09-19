'use client';
import { ILicensesGetSuccessResponse } from '@/app/api/(dashboard)/licenses/route';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LicenseModalContext } from '@/providers/LicenseModalProvider';
import { Copy, Edit, Ellipsis, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';
import { toast } from 'sonner';

interface LicensesActionDropdownProps {
  license: ILicensesGetSuccessResponse['licenses'][number];
}

export const LicensesActionDropdown = ({
  license,
}: LicensesActionDropdownProps) => {
  const t = useTranslations();
  const ctx = useContext(LicenseModalContext);

  const handleCopy = (licenseKey: string) => {
    navigator.clipboard.writeText(licenseKey);
    toast.success(t('general.copied_to_clipboard'));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost">
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="font-medium" forceMount>
        <DropdownMenuItem
          className="hover:cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy(license.licenseKey);
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          {t('general.click_to_copy')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            ctx.setLicenseToEdit(license);
            ctx.setLicenseModalOpen(true);
          }}
        >
          <Edit className="mr-2 h-4 w-4" />
          {t('dashboard.licenses.edit_license')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive hover:cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            ctx.setLicenseToDelete(license);
            ctx.setLicenseToDeleteModalOpen(true);
          }}
        >
          <Trash className="mr-2 h-4 w-4" />
          {t('dashboard.licenses.delete_license')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
