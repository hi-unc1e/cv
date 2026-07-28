const assert = require("node:assert/strict");
const { scoreResponses } = require("../static/funny/work-checkin/score.js");

const questions = [
  { dimension: "energy", positive: true }, { dimension: "energy" }, { dimension: "energy" },
  { dimension: "agency", positive: true }, { dimension: "agency" }, { dimension: "agency", positive: true },
  { dimension: "connection", positive: true }, { dimension: "connection", positive: true }, { dimension: "connection" },
  { dimension: "recovery", positive: true }, { dimension: "recovery", positive: true }, { dimension: "recovery" }
];
const bestCase = [4, 0, 0, 4, 0, 4, 4, 4, 0, 4, 4, 0];
const worstCase = [0, 4, 4, 0, 4, 0, 0, 0, 4, 0, 0, 4];

const best = scoreResponses(bestCase, questions);
assert.equal(best.total, 0);
assert.deepEqual(best.dimensions, { energy: 0, agency: 0, connection: 0, recovery: 0 });
assert.equal(best.status.code, "NOMINAL");

const worst = scoreResponses(worstCase, questions);
assert.equal(worst.total, 48);
assert.deepEqual(worst.dimensions, { energy: 12, agency: 12, connection: 12, recovery: 12 });
assert.equal(worst.status.code, "PAUSE");

for (const [target, expected] of [[11, "NOMINAL"], [12, "WATCH"], [23, "WATCH"], [24, "REDUCE"], [35, "REDUCE"], [36, "PAUSE"]]) {
  const responses = [...bestCase];
  let remaining = target;
  for (let index = 0; index < responses.length && remaining > 0; index += 1) {
    const signal = Math.min(4, remaining);
    responses[index] = questions[index].positive ? 4 - signal : signal;
    remaining -= signal;
  }
  assert.equal(scoreResponses(responses, questions).status.code, expected);
}

assert.throws(() => scoreResponses([0], questions), TypeError);
assert.throws(() => scoreResponses([...bestCase.slice(0, 11), 5], questions), RangeError);
console.log("work-checkin scoring tests passed");
