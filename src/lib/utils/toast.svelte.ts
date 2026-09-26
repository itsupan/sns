export interface ToastMessage {
	id: number;
	text: string;
}

class ToastStore {
	current = $state<ToastMessage | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;
	private nextId = 1;

	show(text: string, duration = 2200) {
		if (this.timer) clearTimeout(this.timer);
		this.current = { id: this.nextId++, text };
		this.timer = setTimeout(() => (this.current = null), duration);
	}

	dismiss() {
		if (this.timer) clearTimeout(this.timer);
		this.current = null;
	}
}

export const toast = new ToastStore();
