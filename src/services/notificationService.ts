export interface AppNotice {
  id: string;
  title: string;
  message: string;
  kind: 'error' | 'info' | 'confirm';
  actionLabel?: string;
  destructive?: boolean;
}

let notices: AppNotice[] = [];
let sequence = 0;
const listeners = new Set<(items: AppNotice[]) => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const answers = new Map<string, (answer: boolean) => void>();
const announced = new Set<string>();
const publish = () => listeners.forEach((listener) => listener([...notices]));

function dismiss(id: string, answer = false) {
  if (!notices.some((notice) => notice.id === id)) return;
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  const resolve = answers.get(id);
  answers.delete(id);
  notices = notices.filter((notice) => notice.id !== id);
  publish();
  resolve?.(answer);
}

function show(input: Omit<AppNotice, 'id'> & {id?: string}, duration = 7000) {
  if (input.id && announced.has(input.id)) return;
  if (notices.some((notice) => notice.kind === input.kind && notice.message === input.message)) return;
  const id = input.id || `notice-${++sequence}`;
  if (input.id) {
    announced.add(input.id);
    if (announced.size > 100) announced.delete(announced.values().next().value!);
  }
  const transient = notices.filter((notice) => notice.kind !== 'confirm');
  if (transient.length >= 2) dismiss(transient[0].id);
  notices = [...notices, {...input, id}];
  publish();
  timers.set(id, setTimeout(() => dismiss(id), duration));
}

export const notifications = {
  subscribe(listener: (items: AppNotice[]) => void) {
    listeners.add(listener);
    listener([...notices]);
    return () => { listeners.delete(listener); };
  },
  dismiss,
  dismissAll() { for (const notice of [...notices]) dismiss(notice.id); },
  error(message: string) { show({title: 'Action impossible', message, kind: 'error'}); },
  announce(id: string, title: string, message: string) { show({id, title, message, kind: 'info'}, 12000); },
  confirmAction(input: {title: string; message: string; actionLabel: string; destructive?: boolean}): Promise<boolean> {
    // Only one pending destructive action; repeated clicks never execute it twice.
    if (notices.some((notice) => notice.kind === 'confirm')) return Promise.resolve(false);
    const id = `confirm-${++sequence}`;
    return new Promise((resolve) => {
      answers.set(id, resolve);
      notices = [...notices, {...input, id, kind: 'confirm'}];
      publish();
    });
  },
};
