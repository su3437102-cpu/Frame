export function report_panic(instance, message) {
    try { new BroadcastChannel('negs-engine-panic').postMessage({ instance, message }); } catch {}
}