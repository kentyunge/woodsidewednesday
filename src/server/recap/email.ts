import { formatDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import type { StandingRow } from "../league";
import type { RecapFacts } from "./facts";
import type { RecapNarrative } from "./writer";

const GREEN = "#2f6b45";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Escape, then allow **bold** only. */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");

export interface RecapEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderRecapEmail(
  narrative: RecapNarrative,
  facts: RecapFacts,
  standings: StandingRow[],
  appUrl: string | null,
): RecapEmail {
  const when = formatDate(facts.date, { weekday: "long", month: "long", day: "numeric" });
  const th = `style="padding:6px 8px;text-align:left;font-size:12px;color:#5b6b60;border-bottom:1px solid #dfe7e1"`;
  const thR = th.replace("text-align:left", "text-align:right");
  const td = `style="padding:6px 8px;border-bottom:1px solid #eef2ef"`;
  const tdR = `style="padding:6px 8px;border-bottom:1px solid #eef2ef;text-align:right"`;

  const standingsHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr>
        <th ${th}>#</th><th ${th}>Golfer</th><th ${thR}>Pts</th><th ${thR}>W-L-T</th><th ${thR}>Avg</th><th ${thR}>Hcp</th>
      </tr></thead>
      <tbody>${standings
        .map(
          (r) => `<tr>
          <td ${td}>${r.rank}</td>
          <td ${td}>${esc(r.golfer.name)}</td>
          <td ${tdR}><strong>${fmt(r.points)}</strong></td>
          <td ${tdR}>${r.wins}-${r.losses}-${r.ties}</td>
          <td ${tdR}>${fmt(r.avgPoints)}</td>
          <td ${tdR}>${fmt(r.handicap)}</td>
        </tr>`,
        )
        .join("")}</tbody>
    </table>`;

  const next = facts.nextWeek;
  const nextTitle = next
    ? `Week ${next.week}${next.positionNight ? " · Position night" : ""} · ${formatDate(next.date, { weekday: "long", month: "long", day: "numeric" })}`
    : null;
  const nextLines = next
    ? next.matchups.length
      ? next.matchups
      : [next.positionNight ? "Pairings are set from the final standings: 1 v 2, 3 v 4, …" : "Matchups to be announced."]
    : ["That's a wrap for the season."];

  const sectionsHtml = narrative.sections
    .map(
      (s) => `
      <h2 style="margin:24px 0 8px;font-size:18px;color:${GREEN}">${esc(s.heading)}</h2>
      ${s.paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.55">${rich(p)}</p>`).join("")}`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2a22">
  <span style="display:none;max-height:0;overflow:hidden">${esc(narrative.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:${GREEN};color:#ffffff;padding:18px 24px">
        <div style="font-size:13px;opacity:.85">${esc(facts.league)} · ${esc(facts.season)}</div>
        <div style="font-size:22px;font-weight:700">Week ${facts.week} recap</div>
        <div style="font-size:13px;opacity:.85">${esc(when)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px 16px;font-size:15px">
        ${sectionsHtml}
        <h2 style="margin:28px 0 8px;font-size:18px;color:${GREEN}">Standings</h2>
        ${standingsHtml}
        <h2 style="margin:28px 0 8px;font-size:18px;color:${GREEN}">Next week</h2>
        ${nextTitle ? `<div style="font-size:13px;color:#5b6b60;margin-bottom:6px">${esc(nextTitle)}</div>` : ""}
        <ul style="margin:0 0 12px;padding-left:20px;line-height:1.7">${nextLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <p style="margin:24px 0 8px;line-height:1.55">${rich(narrative.signoff)}</p>
        ${appUrl ? `<p style="margin:16px 0 0"><a href="${esc(appUrl)}" style="color:${GREEN}">Open Woodside Wednesday</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const pad = (s: string, n: number) => s.padEnd(n);
  const text = [
    `${facts.league} · ${facts.season} · Week ${facts.week} recap (${when})`,
    "",
    ...narrative.sections.flatMap((s) => [s.heading.toUpperCase(), ...s.paragraphs.map(plain), ""]),
    "STANDINGS",
    ...standings.map(
      (r) =>
        `${String(r.rank).padStart(2)}. ${pad(r.golfer.name, 22)} ${String(fmt(r.points)).padStart(5)} pts  ${r.wins}-${r.losses}-${r.ties}  hcp ${fmt(r.handicap)}`,
    ),
    "",
    "NEXT WEEK",
    ...(nextTitle ? [nextTitle] : []),
    ...nextLines.map((l) => `- ${l}`),
    "",
    plain(narrative.signoff),
    ...(appUrl ? ["", appUrl] : []),
  ].join("\n");

  return { subject: narrative.subject, html, text };
}
