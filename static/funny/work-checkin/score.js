(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.WorkCheckinScore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIMENSIONS = ["energy", "agency", "connection", "recovery"];
  const STATUS_LEVELS = [
    { max: 11, code: "NOMINAL", title: "稳态巡航", summary: "目前的工作节奏大体可控。继续保护那些让你恢复和专注的习惯。" },
    { max: 23, code: "WATCH", title: "有点吃力", summary: "有些信号正在闪烁。现在做一次小调整，通常比等到彻底没电更划算。" },
    { max: 35, code: "REDUCE", title: "需要减载", summary: "多个区域在争抢你的电量。先少扛一点，再考虑怎样跑得更快。" },
    { max: 48, code: "PAUSE", title: "先停一下", summary: "系统正在高负载运行。把休息和求助当成维护动作，不是失败证明。" }
  ];

  function scoreResponses(responses, questions) {
    if (!Array.isArray(responses) || !Array.isArray(questions) || responses.length !== questions.length) {
      throw new TypeError("responses and questions must be arrays of equal length");
    }

    const dimensions = Object.fromEntries(DIMENSIONS.map((name) => [name, 0]));
    responses.forEach((answer, index) => {
      if (!Number.isInteger(answer) || answer < 0 || answer > 4) {
        throw new RangeError(`answer ${index + 1} must be an integer from 0 to 4`);
      }
      const question = questions[index];
      if (!DIMENSIONS.includes(question.dimension)) {
        throw new RangeError(`unknown dimension: ${question.dimension}`);
      }
      dimensions[question.dimension] += question.positive ? 4 - answer : answer;
    });

    const total = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
    const status = STATUS_LEVELS.find((level) => total <= level.max);
    const highest = DIMENSIONS.reduce((current, name) => (
      dimensions[name] > dimensions[current] ? name : current
    ), DIMENSIONS[0]);
    return { total, dimensions, highest, status };
  }

  return { DIMENSIONS, STATUS_LEVELS, scoreResponses };
});
