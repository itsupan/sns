export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
	id: number;
	text: string;
	type: ToastType;
}

class ToastStore {
	current = $state<ToastMessage | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;
	private nextId = 1;

	show(text: string, duration = 3500, type: ToastType = 'info') {
		if (this.timer) clearTimeout(this.timer);
		this.current = { id: this.nextId++, text, type };
		this.timer = setTimeout(() => (this.current = null), duration);
	}

	success(text: string, duration = 3500) {
		this.show(text, duration, 'success');
	}

	error(text: string, duration = 4000) {
		this.show(text, duration, 'error');
	}

	dismiss() {
		if (this.timer) clearTimeout(this.timer);
		this.current = null;
	}
}

export const toast = new ToastStore();
