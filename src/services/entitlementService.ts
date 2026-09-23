import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, NativeModules, Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import type { MonthlyUsage, SubscriptionPlan, Transaction } from '@/domain/models';
import type { EntitlementService } from '@/services/contracts';
import { calculateMonthlyUsage } from '@/utils/usage';

export interface BillingStatus {
  available: boolean;
  message: string;
}

const LOCAL_PLAN: SubscriptionPlan = { id: 'free', name: 'Local · Unlimited', monthlyTransactionLimit: null, isMock: false };
const FREE_PLAN: SubscriptionPlan = { id: 'free', name: 'Free', monthlyTransactionLimit: 50, isMock: false };
const PRO_PLAN: SubscriptionPlan = { id: 'pro', name: 'Pro', monthlyTransactionLimit: null, isMock: false };
let sdkPromise: Promise<typeof import('react-native-purchases').default> | null = null;

function apiKey(): string | undefined {
  return Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;
}

export function getBillingStatus(): BillingStatus {
  if (Platform.OS === 'web') return { available: false, message: 'All local features are unlimited on the web. Store subscriptions are available in configured iOS and Android builds.' };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !NativeModules.RNPurchases) {
    return { available: false, message: 'All local features are unlimited in this preview. Store purchases require an installed native build.' };
  }
  const key = apiKey();
  if (!key) return { available: false, message: 'All local features are unlimited. Billing has not been configured for this build.' };
  if (!key.startsWith(Platform.OS === 'ios' ? 'appl_' : 'goog_')) {
    return { available: false, message: 'All local features are unlimited. Billing needs a valid public key for this app store.' };
  }
  return { available: true, message: 'Subscriptions are handled by your app store through RevenueCat. Free includes 50 new transactions per month; Pro removes that limit.' };
}

async function billingSdk() {
  const status = getBillingStatus();
  if (!status.available) throw new Error(status.message);
  if (!sdkPromise) {
    sdkPromise = import('react-native-purchases').then(({ default: Purchases }) => {
      Purchases.configure({ apiKey: apiKey()! });
      return Purchases;
    }).catch((error: unknown) => {
      sdkPromise = null;
      throw error;
    });
  }
  return sdkPromise;
}

function customerPlan(customer: CustomerInfo): SubscriptionPlan {
  const entitlementId = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';
  return customer.entitlements.active[entitlementId] ? { ...PRO_PLAN } : { ...FREE_PLAN };
}

export class RevenueCatEntitlementService implements EntitlementService {
  async getCurrentPlan(): Promise<SubscriptionPlan> {
    if (!getBillingStatus().available) return { ...LOCAL_PLAN };
    const sdk = await billingSdk();
    return customerPlan(await sdk.getCustomerInfo());
  }

  getMonthlyUsage(transactions: Transaction[], plan: SubscriptionPlan, now = new Date()): MonthlyUsage {
    return calculateMonthlyUsage(transactions, plan, now);
  }

  canSaveTransaction(usage: MonthlyUsage): boolean {
    return !usage.isLimitReached;
  }

  async getOfferings(): Promise<PurchasesPackage[]> {
    const sdk = await billingSdk();
    const offerings = await sdk.getOfferings();
    return offerings.current?.availablePackages ?? [];
  }

  async purchase(pack: PurchasesPackage): Promise<SubscriptionPlan> {
    const sdk = await billingSdk();
    const result = await sdk.purchasePackage(pack);
    return customerPlan(result.customerInfo);
  }

  async restore(): Promise<SubscriptionPlan> {
    const sdk = await billingSdk();
    return customerPlan(await sdk.restorePurchases());
  }

  async manage(): Promise<void> {
    const sdk = await billingSdk();
    const customer = await sdk.getCustomerInfo();
    const url = customer.managementURL ?? (Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions');
    if (!/^https:\/\//.test(url)) throw new Error('The store subscription link is unavailable.');
    await Linking.openURL(url);
  }
}

export const entitlementService = new RevenueCatEntitlementService();
