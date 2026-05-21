/**
 * Patches globalThis with the given overrides for the duration of a test,
 * then restores the original values automatically via `t.after`.
 *
 * @param {import('node:test').TestContext} t - The test context from node:test.
 * @param {Record<string, unknown>} overrides - Globals to patch.
 */
export function mockGlobals(t, overrides) {
    const saved = {};
    for (const [k, v] of Object.entries(overrides)) {
        saved[k] = globalThis[k];
        globalThis[k] = v;
    }
    t.after(() => {
        for (const [k, v] of Object.entries(saved)) {
            globalThis[k] = v;
        }
    });
}
