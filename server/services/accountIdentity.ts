export function displayedNexoraId(referralCode: string | undefined, userId: string): string {
  return (referralCode || userId).replace(/\D/g, '').slice(-5).padStart(5, '0');
}
