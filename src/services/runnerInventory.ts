import { OwnedRunner, User } from '../types/auth';

export function getOwnedRunnerInstances(ownedRunners: User['ownedRunners']): OwnedRunner[] {
  if (!Array.isArray(ownedRunners)) return [];

  return ownedRunners.flatMap((runner): OwnedRunner[] => {
    if (typeof runner === 'string') {
      const digits = runner.replace(/\D/g, '').slice(-4).padStart(4, '0');
      return [{
        id: runner,
        runnerId: runner,
        serial: digits,
        purchasedAt: 0,
      }];
    }
    if (
      runner &&
      typeof runner.id === 'string' &&
      typeof runner.runnerId === 'string' &&
      typeof runner.serial === 'string'
    ) {
      return [runner];
    }
    return [];
  });
}
