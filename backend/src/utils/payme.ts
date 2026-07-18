import crypto from 'crypto';

export function createPaymeAuth(merchantId: string, merchantKey: string) {
  const token = Buffer.from(`${merchantId}:${merchantKey}`).toString('base64');
  return `Basic ${token}`;
}

export function createPaymeSignature(payload: string, merchantKey: string) {
  // Simple HMAC-SHA256 signature — sufficient for tests
  return crypto.createHmac('sha256', merchantKey).update(payload).digest('hex');
}

export default { createPaymeAuth, createPaymeSignature };
