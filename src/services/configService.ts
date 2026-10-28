import {completeBankingCatalog} from '../config/completeBankingCatalog';
import {describeQueueRules} from '../config/ruleDescriptions';
import { QueueSystemConfig, BrandConfig, QueueRule } from '../types/queueTypes';
import {
  DEFAULT_QUEUE_CONFIG,
  CAPTUREDOC_SERVICES_CATEGORIES,
  CAPTUREDOC_SERVICES_COUNTERS,
  BANKING_CATEGORIES,
  BANKING_COUNTERS,
} from '../config/defaultQueueConfig';
import { DEFAULT_QUEUE_RULES } from '../config/defaultQueueRules';

const CONFIG_STORAGE_KEY = 'capturedoc_queue_config_v3';
const CONFIG_SYNC_CHANNEL = 'capturedoc_config_sync_channel';

class ConfigService {
  private config: QueueSystemConfig = DEFAULT_QUEUE_CONFIG;
  private listeners: Set<(cfg: QueueSystemConfig) => void> = new Set();
  private channel: BroadcastChannel | null = null;

  constructor() {
    // Proactively clear legacy storage keys that had old brands (SGA / AGB)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('agb_queue_config_override');
        localStorage.removeItem('agb_config_sync_channel');
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CONFIG_SYNC_CHANNEL);
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'CONFIG_UPDATED') {
          this.loadFromStorage();
        }
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === CONFIG_STORAGE_KEY) {
          this.loadFromStorage();
        }
      });
    }
  }

  public async init(): Promise<QueueSystemConfig> {
    // 1. Try local storage override first
    const saved = this.loadFromStorage();
    if (saved) {
      return saved;
    }

    // 2. Fetch from public/config.json
    try {
      const res = await fetch('./config.json');
      if (res.ok) {
        const json = await res.json();
        if (json && json.queueConfig) {
          this.config = {...json.queueConfig,categories:completeBankingCatalog(json.queueConfig.categories||DEFAULT_QUEUE_CONFIG.categories),rules:describeQueueRules(json.queueConfig.rules||DEFAULT_QUEUE_RULES)};
          this.notify();
          return this.getConfig();
        }
      }
    } catch (e) {
      console.warn('[ConfigService] Failed to load config.json, using fallback', e);
    }

    // 3. Fallback safety object
    this.config = this.getFallbackConfig();
    this.notify();
    return this.getConfig();
  }

  private loadFromStorage(): QueueSystemConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed: QueueSystemConfig = JSON.parse(stored);
        // Keep availableBrands in sync with DEFAULT_QUEUE_CONFIG (CaptureDoc, AGB, SGA)
        parsed.availableBrands = DEFAULT_QUEUE_CONFIG.availableBrands;

        // If the stored brand is not in availableBrands, fallback to default brand
        const validBrand = DEFAULT_QUEUE_CONFIG.availableBrands.find(
          (b) => b.id === parsed.brand?.id
        );
        if (!validBrand) {
          parsed.brand = DEFAULT_QUEUE_CONFIG.brand;
          parsed.categories = DEFAULT_QUEUE_CONFIG.categories;
          parsed.counters = DEFAULT_QUEUE_CONFIG.counters;
          this.saveConfig(parsed);
        } else {
          parsed.brand = { ...validBrand, ...parsed.brand };
        }

        const agency = new URLSearchParams(window.location.search).get('agency') || sessionStorage.getItem('queue_agency');
        if (agency && parsed.agencies.some((a) => a.id === agency)) parsed.selectedAgencyId = agency;
        const savedCategories = parsed.categories;
        parsed.categories = completeBankingCatalog(parsed.categories);
        if (parsed.categories !== savedCategories) localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(parsed));
        for (const category of parsed.categories) {
          const credit = category.subOperations.find((op) => op.id === 'sub-credit-conso-immo');
          const defaults = BANKING_CATEGORIES.flatMap((c) => c.subOperations).find((op) => op.id === 'sub-credit-conso-immo');
          if (credit && defaults && credit.requiredDocuments.length <= 1) {
            credit.requiredDocuments = [...credit.requiredDocuments, ...defaults.requiredDocuments.filter((doc) => !credit.requiredDocuments.some((existing) => existing.id === doc.id))];
          }
        }
        parsed.rules=describeQueueRules(parsed.rules?.length?parsed.rules:DEFAULT_QUEUE_RULES);
        this.config = parsed;
        this.notify();
        return parsed;
      }
    } catch (e) {
      console.error('[ConfigService] Error reading storage', e);
    }
    return null;
  }

  public getConfig(): QueueSystemConfig {
    if (!this.config) {
      return this.getFallbackConfig();
    }
    if (typeof window !== 'undefined') {
      const agency = new URLSearchParams(window.location.search).get('agency') || sessionStorage.getItem('queue_agency');
      if (agency && this.config.agencies.some((a) => a.id === agency)) return { ...this.config, selectedAgencyId: agency };
    }
    return this.config;
  }

  public saveConfig(newConfig: QueueSystemConfig): void {
    newConfig={...newConfig,categories:completeBankingCatalog(newConfig.categories),rules:describeQueueRules(newConfig.rules?.length?newConfig.rules:DEFAULT_QUEUE_RULES)};
    this.config = newConfig;
    if (typeof window !== 'undefined') {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    }
    this.channel?.postMessage({ type: 'CONFIG_UPDATED' });
    this.notify();
  }

  public switchBrand(brandId: string): void {
    const current = this.getConfig();
    const brand = current.availableBrands.find((b) => b.id === brandId);
    if (brand) {
      const isServices = brandId === 'capturedoc-services';
      const updated: QueueSystemConfig = {
        ...current,
        brand: { ...brand },
        categories: isServices ? CAPTUREDOC_SERVICES_CATEGORIES : BANKING_CATEGORIES,
        counters: isServices ? CAPTUREDOC_SERVICES_COUNTERS : BANKING_COUNTERS,
      };
      this.saveConfig(updated);
    }
  }

  public updateBrandConfig(brand: BrandConfig): void {
    const current = this.getConfig();
    const existingIndex = current.availableBrands.findIndex((b) => b.id === brand.id);
    const available = [...current.availableBrands];
    if (existingIndex >= 0) {
      available[existingIndex] = brand;
    } else {
      available.push(brand);
    }
    this.saveConfig({
      ...current,
      brand,
      availableBrands: available,
    });
  }

  public selectAgency(agencyId: string): void {
    const current = this.getConfig();
    if (current.agencies.some((a) => a.id === agencyId)) {
      sessionStorage.setItem('queue_agency', agencyId);
      const url = new URL(window.location.href); url.searchParams.set('agency', agencyId);
      window.history.replaceState({}, '', url);
      this.config = { ...current, selectedAgencyId: agencyId };
      this.notify();
    }
  }

  public resetToDefault(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
    this.init();
    this.channel?.postMessage({ type: 'CONFIG_UPDATED' });
  }

  public getRules(): QueueRule[] {
    const cfg = this.getConfig();
    if (!cfg.rules || cfg.rules.length === 0) {
      return DEFAULT_QUEUE_RULES;
    }
    return describeQueueRules(cfg.rules);
  }

  public updateRule(ruleId: string, updates: Partial<QueueRule>): void {
    const current = this.getConfig();
    const rules = [...this.getRules()];
    const index = rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      rules[index] = { ...rules[index], ...updates };
      this.saveConfig({
        ...current,
        rules,
      });
    }
  }

  public updateRuleParameter(ruleId: string, paramKey: string, val: any): void {
    const current = this.getConfig();
    const rules = [...this.getRules()];
    const index = rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      const targetRule = rules[index];
      if (targetRule.parameters[paramKey]) {
        targetRule.parameters[paramKey].value = val;
        this.saveConfig({
          ...current,
          rules,
        });
      }
    }
  }

  public toggleRule(ruleId: string, enabled: boolean): void {
    this.updateRule(ruleId, { enabled });
  }

  public resetRulesToDefault(): void {
    const current = this.getConfig();
    this.saveConfig({
      ...current,
      rules: JSON.parse(JSON.stringify(DEFAULT_QUEUE_RULES)),
    });
  }

  public subscribe(cb: (cfg: QueueSystemConfig) => void): () => void {
    this.listeners.add(cb);
    if (this.config) {
      cb(this.getConfig());
    }
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    if (this.config) {
      this.listeners.forEach((cb) => cb(this.getConfig()));
    }
  }

  private getFallbackConfig(): QueueSystemConfig {
    return DEFAULT_QUEUE_CONFIG;
  }
}

export const configService = new ConfigService();
