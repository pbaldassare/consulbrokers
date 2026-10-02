type ProducerCommissionPermissionInput = {
  role: string | null | undefined;
  isAdmin: boolean;
  activeTab: string;
  editingId: string | null;
};

/**
 * I Responsabili Ufficio possono modificare solo le provvigioni di un
 * produttore esistente. La visibilità sulla sede resta demandata alle RLS.
 */
export function canEditProducerCommissions({
  role,
  isAdmin,
  activeTab,
  editingId,
}: ProducerCommissionPermissionInput): boolean {
  if (isAdmin) return true;
  return role === "ufficio" && activeTab === "corrispondente" && Boolean(editingId);
}
