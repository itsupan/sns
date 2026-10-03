import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';

type LoadEvent = Parameters<typeof load>[0];

const run = (env?: Record<string, string>) =>
	load({ platform: env ? { env } : undefined } as unknown as LoadEvent);

describe('root +layout.server.ts', () => {
	it('tells every page whether images may be resized, off unless IMAGE_TRANSFORMS is on', () => {
		expect(run({ IMAGE_TRANSFORMS: 'on' })).toEqual({ imageTransforms: true });
		expect(run({ IMAGE_TRANSFORMS: 'off' })).toEqual({ imageTransforms: false });
		expect(run({})).toEqual({ imageTransforms: false });
		expect(run()).toEqual({ imageTransforms: false });
	});
});
