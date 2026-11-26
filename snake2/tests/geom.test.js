const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { wrapAngle, angleDiff, angleFromOffset, segDist, pointAtArc, trimTrail, trailSegments } = ctx;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test('angles wrap into (-PI, PI] and turns take the short way', () => {
  close(Math.abs(wrapAngle(3 * Math.PI)), Math.PI);
  close(wrapAngle(-3 * Math.PI / 2), Math.PI / 2);
  close(angleDiff(0.1, -0.1), -0.2);
  close(Math.abs(angleDiff(0, Math.PI)), Math.PI);
});

test('an offset gives its angle, and no offset gives none', () => {
  assert.equal(angleFromOffset(0, 0), null);
  close(angleFromOffset(1, 0), 0);
  close(angleFromOffset(0, 1), Math.PI / 2);      // screen down
  close(angleFromOffset(-1, -1), -3 * Math.PI / 4);
});

test('distance from a point to a segment, clamped at the ends', () => {
  close(segDist(5, 3, 0, 0, 10, 0), 3);            // above the middle
  close(segDist(13, 4, 0, 0, 10, 0), 5);           // past the end: measured to the end point
  close(segDist(0, 0, 2, 2, 2, 2), 2 * Math.SQRT2); // a zero-length segment is a point
});

test('pointAtArc walks the trail from the head, and stops at the last point', () => {
  const trail = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  const p = pointAtArc(trail, 1.5);
  close(p.x, 1.5); close(p.y, 0);
  const end = pointAtArc(trail, 5);
  close(end.x, 2); close(end.y, 0);
});

test('trimTrail keeps only the points needed to cover the arc length', () => {
  const trail = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 }));
  trimTrail(trail, 3);
  assert.equal(trail.length, 4, 'head plus three tiles of body');
});

test('trailSegments gives the body segments, skipping the neck', () => {
  const trail = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
  assert.equal(trailSegments(trail, 10, 0).length, 3);
  assert.equal(trailSegments(trail, 10, 1.5).length, 2, 'the first tile is inside the neck');
  assert.equal(trailSegments(trail, 1.5, 0).length, 2, 'stops at the body length');
});

test('trailFrom starts at a point along the trail and follows it on, so the head can be knocked back', () => {
  const trail = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }];
  const t = ctx.trailFrom(trail, 1);
  close(t[0].x, 1); close(t[0].y, 0);
  assert.deepEqual(plain(t.slice(1)), [{ x: 2, y: 0 }, { x: 2, y: 2 }]);
  close(ctx.trailFrom(trail, 0)[0].x, 0);
});
