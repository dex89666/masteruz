// ============================================
// MasterUz — Публичное представление мастера
// /users/masters/search и /users/master/:id открыты без входа:
// наружу только то, что видно на карточке мастера. Белый список —
// новое поле в User не утечёт само по себе.
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

function pick(obj: AnyRecord | null | undefined, keys: readonly string[]): AnyRecord | null {
  if (!obj) return null;
  const out: AnyRecord = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

const USER_FIELDS = ['id', 'role', 'isVerified', 'createdAt', 'isPro', 'proSubscription'] as const;
const PROFILE_FIELDS = ['firstName', 'lastName', 'avatarUrl', 'bio', 'city', 'district'] as const;
const MASTER_PROFILE_FIELDS = [
  'id', 'specializations', 'experienceYears', 'rating', 'completedOrders',
  'isAvailable', 'isOnline', 'lastSeenAt', 'hourlyRate', 'schoolCompleted', 'masterCategories',
  'warrantyDays',
] as const;
const CERTIFICATE_FIELDS = ['id', 'title', 'fileUrl', 'verified', 'verifiedAt', 'createdAt'] as const;
const REVIEW_FIELDS = ['id', 'rating', 'comment', 'createdAt'] as const;

export function toPublicMaster(user: AnyRecord): AnyRecord {
  return {
    ...pick(user, USER_FIELDS),
    profile: pick(user.profile, PROFILE_FIELDS),
    masterProfile: pick(user.masterProfile, MASTER_PROFILE_FIELDS),
    ...(user.certificates && {
      certificates: user.certificates.map((c: AnyRecord) => pick(c, CERTIFICATE_FIELDS)),
    }),
    ...(user.reviewsReceived && {
      reviewsReceived: user.reviewsReceived.map((r: AnyRecord) => ({
        ...pick(r, REVIEW_FIELDS),
        // рецензент — клиент: только имя и аватар
        reviewer: r.reviewer && {
          id: r.reviewer.id,
          profile: pick(r.reviewer.profile, ['firstName', 'avatarUrl']),
        },
      })),
    }),
  };
}
