import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECT_REFERRAL_REWARD_AMOUNT,
  getReferralRewards,
  isEligibleForReferralReward,
  MAX_REFERRAL_REWARD_GENERATION,
  UPLINE_REFERRAL_REWARD_AMOUNT,
} from './referralRules.js';

test('direct referrals earn 100 and second- and third-generation referrals earn 50', () => {
  assert.equal(DIRECT_REFERRAL_REWARD_AMOUNT, 100);
  assert.equal(UPLINE_REFERRAL_REWARD_AMOUNT, 50);
  assert.equal(MAX_REFERRAL_REWARD_GENERATION, 3);
  assert.deepEqual(
    getReferralRewards(['ben', 'paolo', 'fiona', 'rene'], 'buyer'),
    [
      { referrerId: 'ben', generation: 1, amount: 100 },
      { referrerId: 'paolo', generation: 2, amount: 50 },
      { referrerId: 'fiona', generation: 3, amount: 50 },
    ]
  );
});

test('does not reward ancestors beyond the third generation', () => {
  assert.deepEqual(
    getReferralRewards(['ben', 'paolo', 'fiona', 'rene'], 'buyer').map(({ referrerId }) => referrerId),
    ['ben', 'paolo', 'fiona']
  );
});

test('does not pay the same account twice in a cyclic or duplicated referral chain', () => {
  assert.deepEqual(
    getReferralRewards(['ben', 'paolo', 'ben'], 'buyer'),
    [
      { referrerId: 'ben', generation: 1, amount: 100 },
      { referrerId: 'paolo', generation: 2, amount: 50 },
    ]
  );
  assert.deepEqual(getReferralRewards(['buyer', 'ben'], 'buyer'), [
    { referrerId: 'ben', generation: 2, amount: 50 },
  ]);
});

test('a referred member is eligible until their first-purchase reward is claimed', () => {
  assert.equal(isEligibleForReferralReward({ referredByUserId: 'referrer-1' }), true);
  assert.equal(
    isEligibleForReferralReward({ referredByUserId: 'referrer-1', referralRewardClaimed: true }),
    false
  );
});

test('members without a referrer are not eligible for a referral reward', () => {
  assert.equal(isEligibleForReferralReward({}), false);
  assert.equal(isEligibleForReferralReward({ referredByUserId: '' }), false);
});
