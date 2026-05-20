import test from 'node:test';
import assert from 'node:assert/strict';
import { mockGlobals } from './support/mock-globals.js';

test('mockGlobals patches and restores globals', async (t) => {
    globalThis.__testValue = 'original';

    await t.test('patches the global during the test', async (t) => {
        mockGlobals(t, { __testValue: 'patched' });
        assert.equal(globalThis.__testValue, 'patched');
    });

    assert.equal(globalThis.__testValue, 'original');
    delete globalThis.__testValue;
});

test('mockGlobals restores a previously absent global', async (t) => {
    assert.equal(globalThis.__testValue, undefined);

    await t.test('sets a previously absent global', async (t) => {
        mockGlobals(t, { __testValue: 'new' });
        assert.equal(globalThis.__testValue, 'new');
    });

    assert.equal(globalThis.__testValue, undefined);
});
