import {QueueCategory} from '../types/queueTypes';
import {BANKING_CATEGORIES} from './defaultQueueConfig';

// Upgrade older built-in bank menus without discarding custom operations or settings.
export function completeBankingCatalog(categories: QueueCategory[]): QueueCategory[] {
  if (!categories.some((category) => BANKING_CATEGORIES.some((builtin) => builtin.id === category.id))) return categories;
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  let changed = false;
  const updated = categories.map((category) => {
    const builtin = BANKING_CATEGORIES.find((item) => item.id === category.id);
    if (!builtin) return category;
    const missing = builtin.subOperations.filter((operation) => !category.subOperations.some((current) => current.id === operation.id));
    if (!missing.length) return category;
    changed = true;
    return {...category, subOperations: [...category.subOperations, ...copy(missing)]};
  });
  const missingCategories = BANKING_CATEGORIES.filter((category) => !categories.some((current) => current.id === category.id));
  if (missingCategories.length) {changed = true; updated.push(...copy(missingCategories));}
  return changed ? updated : categories;
}
