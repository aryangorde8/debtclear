import { AnalyzeResult } from "@/types";

// Editorial Light palette (matches the site theme)
const INK     = [26, 24, 20] as const;       // #1A1814
const INK_SOFT = [61, 56, 48] as const;      // #3D3830
const INK_MUTE = [122, 112, 100] as const;   // #7A7064
const GOLD    = [156, 122, 46] as const;      // #9C7A2E
const GREEN   = [63, 107, 74] as const;       // #3F6B4A
const RED     = [155, 58, 44] as const;       // #9B3A2C
const BG      = [245, 241, 232] as const;     // #F5F1E8 — cream parchment
const PAPER   = [251, 248, 239] as const;     // #FBF8EF — lighter paper
const RULE    = [200, 191, 168] as const;     // #C8BFA8 — rule-soft

function formatPayoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function formatToday(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function downloadPlanPDF(result: AnalyzeResult): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  const isAvalanche = result.recommended_strategy === "avalanche";
  const recommended = isAvalanche ? result.avalanche : result.snowball;

  let y = M;

  const ensureSpace = (needed: number) => {
    if (y + needed > H - M) { doc.addPage(); y = M; }
  };

  const writeWrapped = (
    text: string,
    opts: { size?: number; bold?: boolean; italic?: boolean; gap?: number; color?: readonly [number, number, number]; indent?: number } = {}
  ) => {
    const size = opts.size ?? 11;
    const lineH = size * 1.45;
    const style = opts.bold ? (opts.italic ? "bolditalic" : "bold") : opts.italic ? "italic" : "normal";
    doc.setFont("times", style);
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? INK));
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, W - M * 2 - indent);
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, M + indent, y);
      y += lineH;
    }
    y += opts.gap ?? 0;
  };

  const rule = (weight = 0.5, color: readonly [number, number, number] = INK) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(M, y, W - M, y);
    y += 1;
  };

  // ── Cover page ──────────────────────────────────────────────────────────────
  // Cream background
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");

  // Top ink rule
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 3, "F");

  // Masthead
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTE);
  const mastheadY = 36;
  doc.text("VOL. I · ISSUE 04", M, mastheadY);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("DebtClear", W / 2, mastheadY, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTE);
  doc.text(`May · MMXXVI`, W - M, mastheadY, { align: "right" });

  // Masthead rule
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, 44, W - M, 44);

  // Eyebrow
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  const letterSpacedEyebrow = "THE PERSONAL DEBT QUARTERLY  ·  COVER FEATURE";
  doc.text(letterSpacedEyebrow, M, 90);

  // Headline
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTE);
  doc.text("YOU WILL BE DEBT-FREE BY", M, 124);

  doc.setFont("times", "bold");
  doc.setFontSize(44);
  doc.setTextColor(...INK);
  doc.text(formatPayoffDate(recommended.months), M, 168);

  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.setTextColor(...INK_SOFT);
  doc.text(`In ${recommended.months} months — using the ${isAvalanche ? "Avalanche" : "Snowball"} method`, M, 192);

  // Ink rule under hero
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, 212, W - M, 212);

  // Stat grid — 4 paper boxes
  const statY = 232;
  const cardW = (W - M * 2 - 16) / 2;
  const cardH = 80;
  const gap = 16;

  const drawStatCard = (x: number, sy: number, label: string, value: string, valueColor: readonly [number, number, number]) => {
    doc.setFillColor(...PAPER);
    doc.rect(x, sy, cardW, cardH, "F");
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.rect(x, sy, cardW, cardH, "S");
    // Left color accent line
    doc.setFillColor(...valueColor);
    doc.rect(x, sy, 3, cardH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK_MUTE);
    doc.text(label.toUpperCase(), x + 14, sy + 20);

    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...valueColor);
    doc.text(value, x + 14, sy + 56);
  };

  drawStatCard(M,               statY,            "Total debt",     `$${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, GOLD);
  drawStatCard(M + cardW + gap, statY,            "Interest saved", `$${result.interest_saved.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, GREEN);
  drawStatCard(M,               statY + cardH + gap, "Months saved", `${result.months_saved} mo`, INK_SOFT);
  drawStatCard(M + cardW + gap, statY + cardH + gap, "Stress score",  `${result.stress_score}/100`,
    result.stress_score >= 75 ? RED : result.stress_score >= 55 ? GOLD : GREEN);

  // Footer
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(M, H - 50, W - M, H - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  doc.text(`Generated ${formatToday()}`, M, H - 36);
  doc.text("debtclear.aryangorde.com", W - M, H - 36, { align: "right" });

  // ── Page 2: Strategy & AI analysis ─────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");
  y = M;

  // Eyebrow
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  doc.text("SECTION III  ·  THE VERDICT", M, y);
  y += 16;

  writeWrapped("Your Strategy", { size: 22, bold: true, italic: true, gap: 4 });
  writeWrapped(
    `The math says ${isAvalanche ? "Avalanche" : "Snowball"} is optimal for your portfolio.`,
    { size: 11, color: INK_MUTE, gap: 18, italic: true }
  );

  // Strategy comparison table
  const tblY = y;
  const tblH = 96;
  doc.setFillColor(...PAPER);
  doc.rect(M, tblY, W - M * 2, tblH, "F");
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.rect(M, tblY, W - M * 2, tblH, "S");

  // Header row
  doc.setFillColor(...INK);
  doc.rect(M, tblY, W - M * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BG);
  doc.text("METHOD",           M + 14, tblY + 14);
  doc.text("DEBT-FREE IN",     M + 200, tblY + 14);
  doc.text("TOTAL INTEREST",   M + 340, tblY + 14);

  // Avalanche row
  const av = result.avalanche;
  const avColor = (isAvalanche ? GOLD : INK_MUTE) as [number, number, number];
  doc.setFont("times", isAvalanche ? "bolditalic" : "normal");
  doc.setFontSize(12);
  doc.setTextColor(...avColor);
  doc.text(`Avalanche${isAvalanche ? "  ✓" : ""}`, M + 14, tblY + 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`${av.months} mo`, M + 200, tblY + 46);
  doc.text(`$${av.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 340, tblY + 46);

  // Divider
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(M, tblY + 56, W - M, tblY + 56);

  // Snowball row
  const sw = result.snowball;
  const swColor = (!isAvalanche ? GOLD : INK_MUTE) as [number, number, number];
  doc.setFont("times", !isAvalanche ? "bolditalic" : "normal");
  doc.setFontSize(12);
  doc.setTextColor(...swColor);
  doc.text(`Snowball${!isAvalanche ? "  ✓" : ""}`, M + 14, tblY + 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`${sw.months} mo`, M + 200, tblY + 80);
  doc.text(`$${sw.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 340, tblY + 80);

  y += tblH + 20;

  // Pull quote
  doc.setFillColor(...PAPER);
  doc.rect(M, y, W - M * 2, 56, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  doc.line(M, y, M, y + 56);
  doc.setFont("times", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...INK_SOFT);
  const savings = result.interest_saved;
  const monthsSaved = result.months_saved;
  const pullText = `"Choosing ${isAvalanche ? "Avalanche" : "Snowball"} saves $${savings.toLocaleString("en-US", { maximumFractionDigits: 0 })} and ${monthsSaved} month${monthsSaved !== 1 ? "s" : ""} of your life back."`;
  const pullLines = doc.splitTextToSize(pullText, W - M * 2 - 20);
  const pullStart = y + 18;
  pullLines.forEach((l: string, i: number) => { doc.text(l, M + 14, pullStart + i * 16); });
  y += 74;

  // AI Analysis
  writeWrapped("Your Advisor's Notes", { size: 14, bold: true, italic: true, gap: 8 });
  const paragraphs = result.ai_analysis.split("\n\n").filter(Boolean);
  for (const p of paragraphs) {
    writeWrapped(p, { size: 10.5, gap: 8, color: INK_SOFT });
  }

  // ── Page 3: Debt list & action steps ───────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");
  y = M;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  doc.text("SECTION X  ·  YOUR LEDGER", M, y);
  y += 16;

  writeWrapped("Your Debts.", { size: 22, bold: true, italic: true, gap: 6 });

  // Table header
  rule(0.8);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  doc.text("NO.", M, y);
  doc.text("ACCOUNT", M + 32, y);
  doc.text("BALANCE", M + 240, y);
  doc.text("APR", M + 336, y);
  doc.text("MIN/MO", M + 400, y);
  y += 6;
  rule(0.5, RULE);
  y += 8;

  const ordered = [...result.debts].sort((a, b) =>
    isAvalanche ? b.rate - a.rate : a.balance - b.balance
  );

  ordered.forEach((d, i) => {
    ensureSpace(24);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(String(i + 1).padStart(2, "0"), M, y);

    doc.setFont("times", "italic");
    doc.setTextColor(...INK);
    doc.text(d.name, M + 32, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(i === 0 ? GOLD[0] : INK[0], i === 0 ? GOLD[1] : INK[1], i === 0 ? GOLD[2] : INK[2]);
    doc.text(`$${d.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 240, y);

    doc.setTextColor(d.rate > 20 ? RED[0] : INK[0], d.rate > 20 ? RED[1] : INK[1], d.rate > 20 ? RED[2] : INK[2]);
    doc.text(`${d.rate.toFixed(2)}%`, M + 336, y);

    doc.setTextColor(...INK);
    doc.text(`$${d.min_payment.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 400, y);

    if (i === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text(">> attack first", M + 452, y);
    }

    y += 6;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 12;
  });

  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTE);
  doc.text("SECTION XI  ·  ACTION PLAN", M, y);
  y += 16;

  writeWrapped("Your Action Plan.", { size: 18, bold: true, italic: true, gap: 12 });

  const top = ordered[0];
  const aimAt = top.min_payment + result.extra_payment;
  const steps = [
    `This month: pay $${aimAt.toLocaleString("en-US", { maximumFractionDigits: 0 })} toward "${top.name}" — that's its $${top.min_payment.toFixed(0)} minimum plus your $${result.extra_payment.toFixed(0)} extra. Every other debt gets its minimum only.`,
    `Next month: same playbook. Compounding works against you on the high-rate balance — every dollar redirected here saves the most.`,
    `When "${top.name}" is paid off: roll its full payment into the next debt. Don't shrink your monthly outflow — accelerate it.`,
    `Every quarter: re-run your numbers in DebtClear. As balances fall, your stress score drops and strategy sharpens.`,
    `Track wins: every paid-off account is a permanent raise. Your future self gets that money back every month, forever.`,
  ];

  steps.forEach((step, i) => {
    ensureSpace(40);
    // Number — aligned to first text line
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GOLD);
    doc.text(`${i + 1}.`, M, y);
    // Step text — indented, same baseline as number
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK_SOFT);
    const lines = doc.splitTextToSize(step, W - M * 2 - 32);
    lines.forEach((line: string, li: number) => {
      if (li > 0) y += 15;
      ensureSpace(16);
      doc.text(line, M + 32, y);
    });
    y += 22; // gap below each step
  });

  // Footer
  rule(0.5, RULE);
  y += 10;
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...INK_MUTE);
  writeWrapped(
    "DebtClear is a planning tool, not financial advice. Numbers come from a deterministic simulator using your inputs.",
    { size: 9, italic: true, color: INK_MUTE }
  );
  writeWrapped(`Generated ${formatToday()} · debtclear.aryangorde.com`, { size: 9, italic: true, color: INK_MUTE });

  doc.save(`debtclear-plan-${Date.now()}.pdf`);
}
