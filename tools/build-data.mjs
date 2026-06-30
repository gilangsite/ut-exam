import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const courses = [
  {
    id: "pengembangan-produk",
    title: "Pengembangan Produk",
    source: "Pengembangan_Produk.md",
  },
  {
    id: "kewirausahaan-digital",
    title: "Kewirausahaan di Era Digital",
    source: "Kewirausahaan_di_Era_Digital.md",
  },
  {
    id: "akuntansi-manajemen",
    title: "Akuntansi Manajemen",
    source: "EMBS4326_-_Akuntansi_Manajemen_-_Jawaban.md",
  },
  {
    id: "manajemen-keuangan",
    title: "Manajemen Keuangan",
    source: "EMBS4210_-_Manajemen_Keuangan.md",
  },
  {
    id: "pemasaran-strategik",
    title: "Pemasaran Strategik",
    source: "quiz_pemasaran_strategik_audit.md",
  },
  {
    id: "manajemen-rantai-pasokan",
    title: "Manajemen Rantai Pasokan",
    source: "quiz_embs4328_manajemen_rantai_pasokan_audit.md",
  },
  {
    id: "audit-sdm",
    title: "Audit SDM",
    source: "quiz_embs4322_audit_sdm_audit.md",
  },
];

const order = ["A", "B", "C", "D"];

function cleanText(value) {
  return value
    .replace(/\*\*✅ Correct\*\*/g, "")
    .replace(/✅\s*Correct/g, "")
    .replace(/✅/g, "")
    .replace(/\*\*/g, "")
    .replace(/^[>\s]+Keterangan:.*$/gim, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanQuizText(value) {
  return cleanText(value.replace(/^>\s?/gm, "")).replace(/`/g, "").trim();
}

function extractCorrectLabels(block, options) {
  const keyMatch = block.match(
    /\*\*Kunci Jawaban(?:\s*\/\s*Correct Labels)?\s*:\*\*\s*([A-D](?:\s*,\s*[A-D])*)/i,
  );
  const fromKey = keyMatch
    ? keyMatch[1].split(",").map((item) => item.trim().toUpperCase())
    : [];
  const fromOptions = options
    .filter((option) => /Correct/i.test(option.raw))
    .map((option) => option.label);
  return [...new Set([...fromKey, ...fromOptions])].filter((label) =>
    order.includes(label),
  );
}

function extractExplanation(block) {
  const match = block.match(
    /\*\*(?:Catatan\s*\/\s*)?Pembahasan:\*\*\s*([\s\S]*)$/i,
  );
  if (!match) {
    return "";
  }

  return cleanText(match[1])
    .split("\n")
    .filter((line) => !/lanjutin ke semua soal/i.test(line))
    .join("\n")
    .replace(/^Jawaban:\s*([A-D])\s*/i, "Jawaban: $1. ")
    .trim();
}

function extractTrailingExplanation(options, correctLabels) {
  if (correctLabels.includes("D")) {
    return "";
  }

  const option = options.find((item) => item.label === "D");
  if (!option) {
    return "";
  }

  const markers = [
    "Klasifikasi kos berdasarkan",
    "Kos tidak langsung dialokasikan",
    "Rugi (loss)",
    "Standar kompetensi",
    "Double entry accounting",
    "Akuntansi keuangan wajib",
    "SCM mengintegrasikan",
  ];
  const index = markers
    .map((marker) => option.text.indexOf(marker))
    .filter((position) => position > 0)
    .sort((a, b) => a - b)[0];

  if (!index) {
    return "";
  }

  const explanation = option.text.slice(index).trim();
  option.text = option.text.slice(0, index).trim();
  option.raw = option.text;
  return explanation;
}

function splitEmbeddedOptions(label, text) {
  const markers = [];
  const inline = /\s([A-D])\.{1,2}\s*/g;
  let match;

  while ((match = inline.exec(text))) {
    const embeddedLabel = match[1].toUpperCase();
    if (order.indexOf(embeddedLabel) > order.indexOf(label)) {
      markers.push({
        label: embeddedLabel,
        index: match.index,
        end: inline.lastIndex,
      });
    }
  }

  if (!markers.length) {
    return [{ label, raw: text, text: cleanText(text) }];
  }

  const result = [];
  let activeLabel = label;
  let start = 0;

  for (const marker of markers) {
    result.push({
      label: activeLabel,
      raw: text.slice(start, marker.index),
      text: cleanText(text.slice(start, marker.index)),
    });
    activeLabel = marker.label;
    start = marker.end;
  }

  result.push({
    label: activeLabel,
    raw: text.slice(start),
    text: cleanText(text.slice(start)),
  });

  return result.filter((option) => option.text);
}

function extractInlineOptionsFromQuestion(questionText) {
  const startMatch = questionText.match(/\sA\.{1,2}\s+/);
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const optionStart = startMatch.index + 1;
  const tail = questionText.slice(optionStart);
  const markers = [];
  const markerRegex = /(?:^|\s)([A-D])\.{1,2}\s+/g;
  let match;

  while ((match = markerRegex.exec(tail))) {
    markers.push({
      label: match[1].toUpperCase(),
      index: match.index + (match[0].startsWith(" ") ? 1 : 0),
      end: markerRegex.lastIndex,
    });
  }

  if (!markers.length || markers[0].label !== "A") {
    return null;
  }

  const options = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const next = markers[index + 1];
    options.push({
      label: marker.label,
      raw: tail.slice(marker.end, next ? next.index : undefined),
      text: cleanText(tail.slice(marker.end, next ? next.index : undefined)),
    });
  }

  return {
    question: questionText.slice(0, optionStart).trim(),
    options: options.filter((option) => option.text),
  };
}

function parseOptionsAndQuestion(block) {
  const keyIndex = block.search(/\*\*Kunci Jawaban/i);
  const optionPart = keyIndex >= 0 ? block.slice(0, keyIndex) : block;
  const lines = optionPart.split("\n");
  const questionLines = [];
  const options = [];
  let sawOption = false;

  for (const line of lines) {
    const bullet = line.match(/^\s*-\s*([A-D])\.{1,2}\s*(.*)$/);
    if (bullet) {
      sawOption = true;
      const label = bullet[1].toUpperCase();
      options.push(...splitEmbeddedOptions(label, bullet[2]));
      continue;
    }

    if (!sawOption) {
      questionLines.push(line);
      continue;
    }

    if (line.trim() && options.length) {
      const last = options[options.length - 1];
      last.raw = `${last.raw} ${line.trim()}`;
      last.text = cleanText(last.raw);
    }
  }

  const questionCandidate = cleanText(questionLines.join("\n"));
  const inline = extractInlineOptionsFromQuestion(questionCandidate);
  const mergedOptions = inline ? [...inline.options, ...options] : options;
  const byLabel = new Map();

  for (const option of mergedOptions) {
    if (!byLabel.has(option.label) && option.text) {
      byLabel.set(option.label, {
        label: option.label,
        text: option.text,
        raw: option.raw,
      });
    }
  }

  return {
    question: cleanText(inline ? inline.question : questionCandidate),
    options: order.filter((label) => byLabel.has(label)).map((label) => {
      const option = byLabel.get(label);
      return {
        label,
        text: option.text,
        raw: option.raw,
      };
    }),
  };
}

function splitQuestionBlocks(markdown) {
  const matches = [...markdown.matchAll(/^## Soal\s+(\d+)/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return {
      number: Number(match[1]),
      block: markdown.slice(start, end).trim(),
    };
  });
}

function splitAuditQuestionBlocks(markdown) {
  const matches = [...markdown.matchAll(/^#{2,3}\s+Q(\d+)/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return {
      number: Number(match[1]),
      block: markdown.slice(start, end).trim(),
    };
  });
}

function extractAuditField(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bold = block.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n]+)`, "i"));
  if (bold) {
    return cleanQuizText(bold[1]);
  }

  const list = block.match(
    new RegExp(`-\\s+\\*\\*${escaped}\\*\\*:\\s*\\\`?([^\\\`\\n]+)\\\`?`, "i"),
  );
  return list ? cleanQuizText(list[1]) : "";
}

function parseAuditOptions(block) {
  const match = block.match(
    /\*\*(?:Choices|Pilihan):\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:Kunci Dokumen|Jawaban Final|Status Audit|Pembahasan|Metadata):\*\*|\n---|\n#{2,3}\s+Q|\s*$)/i,
  );
  if (!match) {
    return [];
  }

  const options = [];
  for (const line of match[1].split("\n")) {
    const option = line.match(/^\s*-\s*\*\*([A-D])\.\*\*\s*(.*)$/);
    if (option) {
      options.push({
        label: option[1].toUpperCase(),
        text: cleanQuizText(option[2]),
      });
      continue;
    }

    if (line.trim() && options.length) {
      const last = options[options.length - 1];
      last.text = cleanQuizText(`${last.text} ${line.trim()}`);
    }
  }

  return order
    .filter((label) => options.some((option) => option.label === label))
    .map((label) => options.find((option) => option.label === label));
}

function parseAuditQuestion({ number, block }) {
  const questionMatch = block.match(
    /\*\*(?:Question|Pertanyaan):\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:Choices|Pilihan):\*\*)/i,
  );
  const explanationMatch = block.match(
    /\*\*Pembahasan:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Metadata:\*\*|\n---|\n#{2,3}\s+Q|\s*$)/i,
  );
  const originalKey =
    extractAuditField(block, "Kunci Dokumen") || extractAuditField(block, "original_key");
  const finalAnswer =
    extractAuditField(block, "Jawaban Final") || extractAuditField(block, "answer");
  const auditStatus =
    extractAuditField(block, "Status Audit") || extractAuditField(block, "status_audit");
  const finalLabels = (finalAnswer.match(/[A-D]/g) || []).filter((label) =>
    order.includes(label),
  );
  const needsReview = /PERLU_REVISI|REVIEW|BERMASALAH/i.test(
    `${finalAnswer} ${auditStatus}`,
  );
  const correctLabels = needsReview ? [] : [...new Set(finalLabels)];
  let explanation = explanationMatch
    ? cleanQuizText(explanationMatch[1])
    : "Dokumen audit tidak menyertakan pembahasan rinci.";

  if (needsReview) {
    explanation = `Audit menandai soal ini perlu revisi opsi. ${explanation}`;
  } else if (originalKey && finalAnswer && originalKey !== finalAnswer) {
    explanation = `Audit mengoreksi kunci dokumen dari ${originalKey} menjadi ${finalAnswer}. ${explanation}`;
  }

  return {
    number,
    question: questionMatch ? cleanQuizText(questionMatch[1]) : "",
    options: parseAuditOptions(block),
    correctLabels,
    explanation,
    needsReview,
    auditStatus: auditStatus || "Sesuai",
    originalKey,
  };
}

function parseCourse(course) {
  const markdown = readFileSync(resolve(root, course.source), "utf8");
  const auditBlocks = splitAuditQuestionBlocks(markdown);
  const questions = auditBlocks.length
    ? auditBlocks.map(parseAuditQuestion)
    : splitQuestionBlocks(markdown).map(({ number, block }) => {
    const parsed = parseOptionsAndQuestion(block);
    const correctLabels = extractCorrectLabels(block, parsed.options);
    const explanationFromBody = extractExplanation(block);
    const explanation =
      explanationFromBody ||
      extractTrailingExplanation(parsed.options, correctLabels) ||
      "Dokumen tidak menyertakan pembahasan rinci. Sistem memakai kunci jawaban yang tertulis pada file markdown.";

    return {
      number,
      question: parsed.question,
      options: parsed.options.map(({ label, text }) => ({ label, text })),
      correctLabels,
      explanation,
      needsReview: false,
    };
  });

  return {
    ...course,
    total: questions.length,
    questions,
  };
}

const data = courses.map(parseCourse);
const audit = data.map((course) => ({
  course: course.title,
  questions: course.questions.length,
  withoutFourOptions: course.questions
    .filter((question) => question.options.length !== 4)
    .map((question) => question.number),
  withoutEnoughOptions: course.questions
    .filter((question) => question.options.length < 2)
    .map((question) => question.number),
  withoutKey: course.questions
    .filter((question) => !question.needsReview && question.correctLabels.length === 0)
    .map((question) => question.number),
  reviewOnly: course.questions
    .filter((question) => question.needsReview)
    .map((question) => question.number),
}));

writeFileSync(
  resolve(root, "data.js"),
  `window.EXAM_DATA = ${JSON.stringify(data, null, 2)};\n`,
);

console.table(audit);

const hasProblems = audit.some(
  (item) => item.withoutEnoughOptions.length || item.withoutKey.length,
);

if (hasProblems) {
  console.error(JSON.stringify(audit, null, 2));
  process.exitCode = 1;
}
