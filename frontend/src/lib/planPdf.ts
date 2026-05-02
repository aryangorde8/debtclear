import { AnalyzeResult } from "@/types";

function formatPayoffDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  const writeWrapped = (text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number]; indent?: number } = {}) => {
    const size = opts.size ?? 11;
    const lineH = size * 1.4;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(30, 30, 35);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(text, W - M * 2 - indent);
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, M + indent, y);
      y += lineH;
    }
    y += opts.gap ?? 0;
  };

  // ── Cover page ──────────────────────────────────────────────────────────────
  // Dark gradient-ish background
  doc.setFillColor(10, 10, 26);
  doc.rect(0, 0, W, H, "F");

  // Accent bar
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, W, 6, "F");

  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(110, 231, 183);
  doc.text("DEBTCLEAR", M, 80);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 200, 220);
  doc.text("Your personalized debt freedom plan", M, 96);

  // Hero block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(160, 180, 200);
  doc.text("YOU WILL BE DEBT-FREE BY", M, 200);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(255, 255, 255);
  doc.text(formatPayoffDate(recommended.months), M, 240);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(180, 200, 220);
  doc.text(`In ${recommended.months} months — using the ${isAvalanche ? "Avalanche" : "Snowball"} method`, M, 264);

  // Stat cards
  const statY = 340;
  const cardW = (W - M * 2 - 20) / 2;
  const cardH = 90;

  const drawStat = (x: number, sy: number, label: string, value: string, accent: [number, number, number]) => {
    doc.setFillColor(20, 22, 40);
    doc.roundedRect(x, sy, cardW, cardH, 8, 8, "F");
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, sy, cardW, cardH, 8, 8, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 160, 180);
    doc.text(label.toUpperCase(), x + 16, sy + 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(value, x + 16, sy + 56);
  };

  drawStat(M, statY, "Total debt", `$${result.total_debt.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, [255, 255, 255]);
  drawStat(M + cardW + 20, statY, "Interest saved", `$${result.interest_saved.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, [110, 231, 183]);
  drawStat(M, statY + cardH + 16, "Months saved", `${result.months_saved} mo`, [147, 197, 253]);
  drawStat(M + cardW + 20, statY + cardH + 16, "Stress score", `${result.stress_score}/100`, [253, 186, 116]);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 140, 160);
  doc.text(`Generated ${formatToday()}`, M, H - 50);
  doc.text("debtclear.aryangorde.com", W - M, H - 50, { align: "right" });

  // ── Page 2: Strategy & AI analysis ─────────────────────────────────────────
  doc.addPage();
  y = M;

  writeWrapped("Your Strategy", { size: 18, bold: true, gap: 6 });
  writeWrapped(
    `The math says ${isAvalanche ? "Avalanche" : "Snowball"} is right for your portfolio.`,
    { size: 11, color: [80, 90, 100], gap: 18 }
  );

  // Strategy comparison table
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(M, y, W - M * 2, 90, 6, 6, "F");
  doc.setDrawColor(220, 225, 230);
  doc.roundedRect(M, y, W - M * 2, 90, 6, 6, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 80);
  doc.text("METHOD", M + 16, y + 22);
  doc.text("DEBT-FREE IN", M + 200, y + 22);
  doc.text("TOTAL INTEREST", M + 340, y + 22);

  doc.setFont("helvetica", isAvalanche ? "bold" : "normal");
  doc.setTextColor(isAvalanche ? 16 : 60, isAvalanche ? 185 : 70, isAvalanche ? 129 : 80);
  doc.setFontSize(11);
  doc.text(`Avalanche${isAvalanche ? "  ✓" : ""}`, M + 16, y + 48);
  doc.setTextColor(60, 70, 80);
  doc.text(`${result.avalanche.months} mo`, M + 200, y + 48);
  doc.text(`$${result.avalanche.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 340, y + 48);

  doc.setFont("helvetica", !isAvalanche ? "bold" : "normal");
  doc.setTextColor(!isAvalanche ? 16 : 60, !isAvalanche ? 185 : 70, !isAvalanche ? 129 : 80);
  doc.text(`Snowball${!isAvalanche ? "  ✓" : ""}`, M + 16, y + 72);
  doc.setTextColor(60, 70, 80);
  doc.text(`${result.snowball.months} mo`, M + 200, y + 72);
  doc.text(`$${result.snowball.total_interest.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 340, y + 72);

  y += 110;

  writeWrapped("Your Advisor's Notes", { size: 14, bold: true, gap: 8 });

  const paragraphs = result.ai_analysis.split("\n\n").filter(Boolean);
  for (const p of paragraphs) {
    writeWrapped(p, { size: 10.5, gap: 10, color: [55, 65, 75] });
  }

  // ── Page 3: Debt list & action steps ───────────────────────────────────────
  doc.addPage();
  y = M;

  writeWrapped("Your Debts", { size: 18, bold: true, gap: 14 });

  // Sort by recommended strategy priority
  const ordered = [...result.debts].sort((a, b) =>
    isAvalanche ? b.rate - a.rate : a.balance - b.balance
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 140);
  doc.text("#", M, y);
  doc.text("DEBT", M + 24, y);
  doc.text("BALANCE", M + 240, y);
  doc.text("APR", M + 340, y);
  doc.text("MIN/MO", M + 410, y);
  y += 8;
  doc.setDrawColor(220, 225, 230);
  doc.line(M, y, W - M, y);
  y += 14;

  ordered.forEach((d, i) => {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(i === 0 ? 16 : 30, i === 0 ? 185 : 30, i === 0 ? 129 : 35);
    doc.text(`${i + 1}`, M, y);
    doc.setTextColor(30, 30, 35);
    doc.text(d.name, M + 24, y);
    doc.setFont("helvetica", "normal");
    doc.text(`$${d.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 240, y);
    doc.text(`${d.rate.toFixed(2)}%`, M + 340, y);
    doc.text(`$${d.min_payment.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, M + 410, y);
    if (i === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(16, 185, 129);
      doc.text("← attack this one first", M + 470, y);
    }
    y += 22;
  });

  y += 14;

  writeWrapped("Your Action Plan", { size: 16, bold: true, gap: 12 });

  const top = ordered[0];
  const aimAt = top.min_payment + result.extra_payment;

  const steps = [
    `This month: pay $${aimAt.toLocaleString("en-US", { maximumFractionDigits: 0 })} toward "${top.name}" — that's its $${top.min_payment.toFixed(0)} minimum plus your full $${result.extra_payment.toFixed(0)} extra. Pay every other debt only its minimum.`,
    `Next month: same playbook. Compounding works against you on the high-rate balance — every dollar redirected here saves the most.`,
    `When "${top.name}" is paid off: roll its full payment into the next debt on the list. Don't shrink your monthly outflow — keep the snowball rolling.`,
    `Every quarter: re-run your numbers in DebtClear. As balances fall, your stress score drops and your strategy tightens.`,
    `Track wins: every paid-off card is a permanent raise. Your future self gets that money back, every month, forever.`,
  ];

  steps.forEach((step, i) => {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text(`${i + 1}.`, M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 50, 60);
    const lines = doc.splitTextToSize(step, W - M * 2 - 24);
    let lineY = y;
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, M + 24, lineY);
      lineY += 15;
    }
    y = lineY + 6;
  });

  // Footer on last page
  ensureSpace(50);
  y = Math.max(y, H - 80);
  doc.setDrawColor(220, 225, 230);
  doc.line(M, y, W - M, y);
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 140);
  doc.text(
    "DebtClear is a planning tool, not financial advice. Numbers come from a deterministic simulator using your inputs.",
    M,
    y
  );
  y += 12;
  doc.text(`Generated ${formatToday()} · debtclear.aryangorde.com`, M, y);

  doc.save(`debtclear-plan-${Date.now()}.pdf`);
}
