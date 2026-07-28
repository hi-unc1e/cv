(function () {
  "use strict";

  const QUESTIONS = [
    { dimension: "energy", positive: true, text: "工作日结束后，我通常还留有一点力气做自己想做的事。" },
    { dimension: "energy", text: "开始一天工作前，我已经有一种“今天又要硬撑”的感觉。" },
    { dimension: "energy", text: "任务切换之后，我需要很久才能重新进入状态。" },
    { dimension: "agency", positive: true, text: "我能决定用什么顺序完成真正重要的任务。" },
    { dimension: "agency", text: "突发任务经常挤掉原计划，却没人帮我重新排优先级。" },
    { dimension: "agency", positive: true, text: "我清楚什么状态算“今天已经做够了”。" },
    { dimension: "connection", positive: true, text: "遇到卡点时，我知道可以找谁把事情说清楚。" },
    { dimension: "connection", positive: true, text: "我完成的工作能收到具体、可信的反馈。" },
    { dimension: "connection", text: "消息和会议很多，但真正理解彼此的时候很少。" },
    { dimension: "recovery", positive: true, text: "下班后，我的大脑通常能从工作频道退出。" },
    { dimension: "recovery", positive: true, text: "最近一周，我至少留出过两段完全不为工作服务的时间。" },
    { dimension: "recovery", text: "即使正在休息，我也会因为没有工作而感到内疚。" }
  ];
  const OPTIONS = ["从不", "偶尔", "一半时候", "经常", "几乎总是"];
  const DIMENSION_COPY = {
    energy: { label: "精力", suggestion: "明天删掉或推迟一个低价值任务，给自己留一段不切换窗口的专注时间。" },
    agency: { label: "掌控", suggestion: "把当前任务按“必须、可以、以后”重新排一次，并明确今天的停止线。" },
    connection: { label: "协作", suggestion: "找一个相关的人，用一句事实和一个具体请求，把最卡的地方说清楚。" },
    recovery: { label: "恢复", suggestion: "今晚安排一段有明确起止时间的离线活动，让大脑收到“已经下班”的信号。" }
  };

  const form = document.querySelector("#checkin-form");
  const questionsNode = document.querySelector("#questions");
  const progressText = document.querySelector("#progress-text");
  const progressFill = document.querySelector("#progress-fill");
  const formError = document.querySelector("#form-error");
  const resultNode = document.querySelector("#result");
  const resetButton = document.querySelector("#reset-checkin");

  function renderQuestions() {
    questionsNode.innerHTML = QUESTIONS.map((question, questionIndex) => {
      const number = questionIndex + 1;
      const choices = OPTIONS.map((label, value) => `
        <label class="choice">
          <input type="radio" name="answer-${number}" value="${value}">
          <span class="choice-dot" aria-hidden="true">${value}</span>
          <span>${label}</span>
        </label>
      `).join("");
      return `
        <fieldset class="question" data-question="${number}">
          <legend><span>${String(number).padStart(2, "0")}</span>${question.text}</legend>
          <div class="choices">${choices}</div>
        </fieldset>
      `;
    }).join("");
  }

  function getResponses() {
    return QUESTIONS.map((_, index) => {
      const checked = form.querySelector(`input[name="answer-${index + 1}"]:checked`);
      return checked ? Number(checked.value) : null;
    });
  }

  function updateProgress() {
    const complete = getResponses().filter((answer) => answer !== null).length;
    progressText.textContent = `${complete} / ${QUESTIONS.length}`;
    progressFill.style.width = `${Math.round((complete / QUESTIONS.length) * 100)}%`;
    progressFill.parentElement.setAttribute("aria-valuenow", String(complete));
  }

  function renderResult(result) {
    const dimensionRows = Object.entries(result.dimensions).map(([name, value]) => `
      <div class="signal-row">
        <div><span>${DIMENSION_COPY[name].label}</span><strong>${value}<small>/12</small></strong></div>
        <div class="signal-track"><span style="width: ${Math.round((value / 12) * 100)}%"></span></div>
      </div>
    `).join("");

    resultNode.dataset.level = result.status.code.toLowerCase();
    resultNode.innerHTML = `
      <div class="result-code"><span>RUN MODE</span><strong>${result.status.code}</strong></div>
      <p class="result-score"><span>${result.total}</span><small>/48 负载信号</small></p>
      <h2>${result.status.title}</h2>
      <p class="result-summary">${result.status.summary}</p>
      <div class="signal-list" aria-label="四项工作状态信号">${dimensionRows}</div>
      <div class="next-move"><span>NEXT SMALL MOVE</span><p>${DIMENSION_COPY[result.highest].suggestion}</p></div>
      <p class="result-note">这不是心理测评或诊断，只是一面帮助你观察最近工作节奏的小镜子。如果状态持续影响生活，和可信任的人或专业人士聊聊会更有帮助。</p>
    `;
    resultNode.hidden = false;
    resultNode.focus();
  }

  renderQuestions();
  updateProgress();

  form.addEventListener("change", function () {
    formError.hidden = true;
    updateProgress();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const responses = getResponses();
    const firstMissing = responses.indexOf(null);
    if (firstMissing !== -1) {
      formError.textContent = `还有 ${responses.filter((answer) => answer === null).length} 题没选。先从第 ${firstMissing + 1} 题继续。`;
      formError.hidden = false;
      questionsNode.children[firstMissing].scrollIntoView({ behavior: "smooth", block: "center" });
      questionsNode.children[firstMissing].querySelector("input").focus({ preventScroll: true });
      return;
    }
    renderResult(window.WorkCheckinScore.scoreResponses(responses, QUESTIONS));
  });

  resetButton.addEventListener("click", function () {
    form.reset();
    resultNode.hidden = true;
    resultNode.innerHTML = "";
    formError.hidden = true;
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
