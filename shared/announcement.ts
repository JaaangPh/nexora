export interface AnnouncementContent {
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  updatedAt: number;
}

export const DEFAULT_ANNOUNCEMENT: AnnouncementContent = {
  title: '🚀 INTRODUCING STEPORA MOVEMENT 👟',
  subtitle: 'Move with purpose. Earn with every step.',
  body: [
    'Your movement is more than just exercise — it’s an opportunity to earn.',
    'Introducing Stepora, a Move-to-Earn platform that transforms verified outdoor activities into on-platform rewards. Whether you’re running solo or moving together with a team, every verified workout brings you closer to your goals.',
    '🏃 Move & Earn — Virtual runner assets determine your earning rate, turning every verified step into an opportunity.\n✅ Verified Movement — Our verification engine validates your workouts to ensure your activity counts.\n🏆 Team Marathons — Join forces with others, combine your distances, and compete for shared bounties.',
    'Step by step. Run by run. Together, we move forward.',
    'The future of movement is here — and every step counts.',
    'Stepora Movement Move with purpose. Earn with every step. 🌍👟',
  ].join('\n\n'),
  imageUrl: '/images/stepora-announcement.png',
  updatedAt: 0,
};

export function normalizeAnnouncement(value: unknown): AnnouncementContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_ANNOUNCEMENT;
  }

  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === 'string' ? record.title : DEFAULT_ANNOUNCEMENT.title,
    subtitle: typeof record.subtitle === 'string' ? record.subtitle : DEFAULT_ANNOUNCEMENT.subtitle,
    body: typeof record.body === 'string' ? record.body : DEFAULT_ANNOUNCEMENT.body,
    imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : DEFAULT_ANNOUNCEMENT.imageUrl,
    updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : DEFAULT_ANNOUNCEMENT.updatedAt,
  };
}
