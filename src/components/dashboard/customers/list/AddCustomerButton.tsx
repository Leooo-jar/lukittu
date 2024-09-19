'use client';
import { Button } from '@/components/ui/button';
import { CustomerModalContext } from '@/providers/CustomerModalProvider';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useContext } from 'react';

export default function AddCustomerButton() {
  const t = useTranslations();
  const ctx = useContext(CustomerModalContext);

  return (
    <Button
      className="ml-auto flex gap-2"
      size="sm"
      variant="default"
      onClick={() => ctx.setCustomerModalOpen(true)}
    >
      <Plus className="h-4 w-4" />
      <span className="max-md:hidden">
        {t('dashboard.customers.add_customer')}
      </span>
    </Button>
  );
}
