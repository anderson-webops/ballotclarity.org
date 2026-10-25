export function useElectionClock() {
	const now = useState<number>("election-view-clock", () => Date.now());
	let timer: ReturnType<typeof setInterval> | undefined;
	onMounted(() => {
		now.value = Date.now();
		timer = setInterval(() => {
			now.value = Date.now();
		}, 60_000);
	});
	onUnmounted(() => {
		if (timer) clearInterval(timer);
	});
	return now;
}
