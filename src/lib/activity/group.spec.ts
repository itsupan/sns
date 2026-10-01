import { describe, expect, it } from 'vitest';
import { activityVerb, actorNames, groupActivity } from './group';
import type { ActivityItem } from './types';

const person = (id: string) => ({ id, name: id, handle: `@${id}`, slug: id, image: null });

function item(
	id: string,
	type: ActivityItem['type'],
	actor: string,
	extra: Partial<ActivityItem> = {}
): ActivityItem {
	return {
		id,
		type,
		createdAt: 0,
		unread: false,
		actor: person(actor),
		post: null,
		comment: null,
		...extra
	};
}

const p1 = { post: { id: 'p1', thumbnail: null } };
const p2 = { post: { id: 'p2', thumbnail: null } };

describe('groupActivity', () => {
	it('groups likes per post, reactions per comment and all follows, keeping newest-first order', () => {
		const groups = groupActivity([
			item('1', 'like', 'bob', { ...p1, unread: true }),
			item('2', 'follow', 'carol'),
			item('3', 'like', 'dan', p2),
			item('4', 'like', 'carol', p1),
			item('5', 'comment', 'bob', p1),
			item('6', 'comment', 'dan', p1),
			item('7', 'follow', 'erin'),
			item('8', 'like', 'bob', p1)
		]);
		expect(groups.map((g) => [g.key, g.type, g.actors.map((a) => a.id), g.unread])).toEqual([
			['1', 'like', ['bob', 'carol'], true],
			['2', 'follow', ['carol', 'erin'], false],
			['3', 'like', ['dan'], false],
			['5', 'comment', ['bob'], false],
			['6', 'comment', ['dan'], false]
		]);
	});

	it('marks a group unread when any of its items is', () => {
		const [group] = groupActivity([
			item('1', 'follow', 'bob'),
			item('2', 'follow', 'carol', { unread: true })
		]);
		expect(group.unread).toBe(true);
	});
});

describe('actorNames and activityVerb', () => {
	it('reads naturally', () => {
		expect(actorNames([person('Bob')])).toBe('Bob');
		expect(actorNames([person('Bob'), person('Carol')])).toBe('Bob and Carol');
		expect(actorNames([person('Bob'), person('Carol'), person('Dan')])).toBe('Bob and 2 others');
		const [g] = groupActivity([item('1', 'reply', 'bob')]);
		expect(activityVerb(g)).toBe('replied to your comment');
	});

	it('describes tags and story reactions, never grouping them', () => {
		const groups = groupActivity([
			item('1', 'mention', 'bob', p1),
			item('2', 'mention', 'carol', p1),
			item('3', 'story_reaction', 'bob')
		]);
		expect(groups.map(activityVerb)).toEqual([
			'tagged you in a post',
			'tagged you in a post',
			'reacted to your story'
		]);
	});
});
