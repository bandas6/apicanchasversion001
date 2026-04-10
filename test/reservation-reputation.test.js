const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeComplexRatingSummary,
    resolveReliabilityBadge,
} = require('../helpers/reservation-reputation');

test('computeComplexRatingSummary returns new status for empty reviews', () => {
    const summary = computeComplexRatingSummary([]);

    assert.equal(summary.rating, null);
    assert.equal(summary.reviewsCount, 0);
    assert.equal(summary.ratingStatus, 'new');
});

test('computeComplexRatingSummary aggregates ratings and breakdown', () => {
    const summary = computeComplexRatingSummary([
        { rating: 5, createdAt: new Date(), updatedAt: new Date() },
        { rating: 4, createdAt: new Date(), updatedAt: new Date() },
        { rating: 4, createdAt: new Date(), updatedAt: new Date() },
    ]);

    assert.equal(summary.reviewsCount, 3);
    assert.equal(summary.ratingAverage, 4.33);
    assert.equal(summary.ratingBreakdown.fiveStars, 1);
    assert.equal(summary.ratingBreakdown.fourStars, 2);
});

test('resolveReliabilityBadge maps score ranges correctly', () => {
    assert.equal(resolveReliabilityBadge(90), 'confiable');
    assert.equal(resolveReliabilityBadge(65), 'normal');
    assert.equal(resolveReliabilityBadge(30), 'con incidencias');
});
