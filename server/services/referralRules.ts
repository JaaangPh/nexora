export const DIRECT_REFERRAL_REWARD_AMOUNT = 100;
export const UPLINE_REFERRAL_REWARD_AMOUNT = 50;
export const MAX_REFERRAL_REWARD_GENERATION = 3;

export interface ReferralReward {
  referrerId: string;
  generation: number;
  amount: number;
}

export function isEligibleForReferralReward(user: {
  referredByUserId?: string;
  referralRewardClaimed?: boolean;
}): boolean {
  return (
    typeof user.referredByUserId === 'string' &&
    user.referredByUserId.length > 0 &&
    user.referralRewardClaimed !== true
  );
}

export function getReferralRewards(referrerIds: Array<string | undefined>, buyerId: string): ReferralReward[] {
  const seenReferrers = new Set([buyerId]);

  return referrerIds
    .slice(0, MAX_REFERRAL_REWARD_GENERATION)
    .flatMap((referrerId, index) => {
      if (!referrerId || seenReferrers.has(referrerId)) return [];
      seenReferrers.add(referrerId);

      const generation = index + 1;
      return [{
        referrerId,
        generation,
        amount: generation === 1
          ? DIRECT_REFERRAL_REWARD_AMOUNT
          : UPLINE_REFERRAL_REWARD_AMOUNT,
      }];
    });
}
