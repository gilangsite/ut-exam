const courses = window.EXAM_DATA || [];

const state = {
  course: null,
  index: 0,
  answers: [],
};

const elements = {
  courseScreen: document.querySelector("#courseScreen"),
  quizScreen: document.querySelector("#quizScreen"),
  finishScreen: document.querySelector("#finishScreen"),
  courseGrid: document.querySelector("#courseGrid"),
  changeCourseBtn: document.querySelector("#changeCourseBtn"),
  finishChangeCourseBtn: document.querySelector("#finishChangeCourseBtn"),
  retryBtn: document.querySelector("#retryBtn"),
  courseLabel: document.querySelector("#courseLabel"),
  quizTitle: document.querySelector("#quizTitle"),
  liveScore: document.querySelector("#liveScore"),
  liveTotal: document.querySelector("#liveTotal"),
  progressBar: document.querySelector("#progressBar"),
  questionCounter: document.querySelector("#questionCounter"),
  questionKey: document.querySelector("#questionKey"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  finishCourse: document.querySelector("#finishCourse"),
  finishScore: document.querySelector("#finishScore"),
  finishDetail: document.querySelector("#finishDetail"),
  mistakeSummary: document.querySelector("#mistakeSummary"),
  reviewList: document.querySelector("#reviewList"),
  resultDialog: document.querySelector("#resultDialog"),
  resultStatus: document.querySelector("#resultStatus"),
  resultTitle: document.querySelector("#resultTitle"),
  selectedAnswer: document.querySelector("#selectedAnswer"),
  correctAnswer: document.querySelector("#correctAnswer"),
  resultExplanation: document.querySelector("#resultExplanation"),
  nextQuestionBtn: document.querySelector("#nextQuestionBtn"),
};

function showScreen(screen) {
  const screens = [elements.courseScreen, elements.quizScreen, elements.finishScreen];
  screens.forEach((item) => item.classList.toggle("hidden", item !== screen));
  elements.changeCourseBtn.classList.toggle("hidden", screen === elements.courseScreen);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatAnswer(question, label) {
  const option = question.options.find((item) => item.label === label);
  return option ? `${option.label}. ${option.text}` : label;
}

function formatCorrectAnswer(question) {
  return question.correctLabels
    .map((label) => formatAnswer(question, label))
    .join(" / ");
}

function currentScore() {
  return state.answers.filter((answer) => answer?.isCorrect).length;
}

function renderParagraphs(container, text) {
  container.replaceChildren();
  const chunks = String(text || "")
    .split(/\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  chunks.forEach((chunk) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = chunk;
    container.append(paragraph);
  });
}

function renderCourses() {
  elements.courseGrid.replaceChildren();

  courses.forEach((course) => {
    const button = document.createElement("button");
    button.className = "course-card";
    button.type = "button";
    button.dataset.courseId = course.id;
    button.addEventListener("click", () => startCourse(course.id));

    const title = document.createElement("h3");
    title.textContent = course.title;

    const source = document.createElement("p");
    source.textContent = course.source;

    const count = document.createElement("span");
    count.className = "course-count";
    count.textContent = `${course.total} soal`;

    button.append(title, source, count);
    elements.courseGrid.append(button);
  });
}

function startCourse(courseId) {
  const course = courses.find((item) => item.id === courseId);
  if (!course) {
    return;
  }

  state.course = course;
  state.index = 0;
  state.answers = Array.from({ length: course.questions.length }, () => null);
  elements.liveTotal.textContent = String(course.questions.length);
  showScreen(elements.quizScreen);
  renderQuestion();
}

function renderQuestion() {
  const question = state.course.questions[state.index];
  const progress = ((state.index + 1) / state.course.questions.length) * 100;

  elements.courseLabel.textContent = state.course.title;
  elements.quizTitle.textContent = "Pilih Jawaban";
  elements.liveScore.textContent = String(currentScore());
  elements.progressBar.style.width = `${progress}%`;
  elements.questionCounter.textContent = `Soal ${state.index + 1} dari ${state.course.questions.length}`;
  elements.questionKey.textContent = `Nomor ${question.number}`;
  elements.questionText.textContent = question.question;
  elements.optionsList.replaceChildren();

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.dataset.option = option.label;
    button.addEventListener("click", () => chooseAnswer(option.label));

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;

    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = option.text;

    button.append(label, text);
    elements.optionsList.append(button);
  });
}

function chooseAnswer(label) {
  const question = state.course.questions[state.index];
  const isCorrect = question.correctLabels.includes(label);

  state.answers[state.index] = {
    label,
    isCorrect,
  };

  elements.liveScore.textContent = String(currentScore());
  showResult(question, label, isCorrect);
}

function showResult(question, label, isCorrect) {
  elements.resultStatus.textContent = isCorrect ? "Jawaban benar" : "Jawaban salah";
  elements.resultStatus.className = `result-status ${isCorrect ? "correct" : "wrong"}`;
  elements.resultTitle.textContent = isCorrect ? "Benar" : "Belum tepat";
  elements.selectedAnswer.textContent = `Pilihan kamu: ${formatAnswer(question, label)}`;
  elements.correctAnswer.textContent = `Kunci: ${formatCorrectAnswer(question)}`;
  renderParagraphs(elements.resultExplanation, question.explanation);
  elements.nextQuestionBtn.textContent =
    state.index + 1 === state.course.questions.length ? "Lihat Skor" : "Lanjut";
  elements.resultDialog.showModal();
}

function goNext() {
  elements.resultDialog.close();

  if (state.index + 1 >= state.course.questions.length) {
    renderFinish();
    return;
  }

  state.index += 1;
  renderQuestion();
}

function renderFinish() {
  const total = state.course.questions.length;
  const score = currentScore();
  const wrongAnswers = state.answers.filter((answer) => answer && !answer.isCorrect);
  const percentage = Math.round((score / total) * 100);

  elements.finishCourse.textContent = state.course.title;
  elements.finishScore.textContent = `${score}/${total}`;
  elements.finishDetail.textContent = `Skor akhir ${percentage}%. Jawaban salah: ${wrongAnswers.length}.`;
  elements.mistakeSummary.textContent =
    wrongAnswers.length === 0
      ? "Semua jawaban kamu benar."
      : `Ada ${wrongAnswers.length} soal yang perlu dicek ulang.`;

  renderReview();
  showScreen(elements.finishScreen);
}

function renderReview() {
  elements.reviewList.replaceChildren();

  state.course.questions.forEach((question, index) => {
    const answer = state.answers[index];
    const isCorrect = Boolean(answer?.isCorrect);
    const card = document.createElement("article");
    card.className = "review-card";

    const top = document.createElement("div");
    top.className = "review-top";

    const title = document.createElement("h3");
    title.textContent = `Soal ${index + 1}. ${question.question}`;

    const status = document.createElement("span");
    status.className = `review-status ${isCorrect ? "correct" : "wrong"}`;
    status.textContent = isCorrect ? "Benar" : "Salah";

    top.append(title, status);

    const answerBlock = document.createElement("div");
    answerBlock.className = "review-answer";

    const selected = document.createElement("p");
    selected.textContent = answer
      ? `Jawaban kamu: ${formatAnswer(question, answer.label)}`
      : "Jawaban kamu: tidak dijawab";

    const correct = document.createElement("p");
    correct.textContent = `Kunci: ${formatCorrectAnswer(question)}`;

    const explanation = document.createElement("div");
    explanation.className = "explanation";
    renderParagraphs(explanation, question.explanation);

    answerBlock.append(selected, correct, explanation);
    card.append(top, answerBlock);
    elements.reviewList.append(card);
  });
}

function resetToCourses() {
  state.course = null;
  state.index = 0;
  state.answers = [];
  showScreen(elements.courseScreen);
}

elements.nextQuestionBtn.addEventListener("click", goNext);
elements.changeCourseBtn.addEventListener("click", resetToCourses);
elements.finishChangeCourseBtn.addEventListener("click", resetToCourses);
elements.retryBtn.addEventListener("click", () => startCourse(state.course.id));
elements.resultDialog.addEventListener("cancel", (event) => event.preventDefault());

renderCourses();
