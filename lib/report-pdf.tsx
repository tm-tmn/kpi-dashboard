import path from "node:path";
import React from "react";
import { Document, Page, Text as PdfText, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { TextProps } from "@react-pdf/renderer";
import type { ReportData, Status } from "./report-data";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  // Sarabun ships Thai and Latin glyphs as separate subset files; register
  // each weight with the Thai file (it also carries digits/basic punctuation
  // that Thai text needs), and fall back to the Latin file for the rest.
  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(FONT_DIR, "sarabun-thai-400-normal.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "sarabun-thai-700-normal.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "SarabunLatin",
    fonts: [
      { src: path.join(FONT_DIR, "sarabun-latin-400-normal.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "sarabun-latin-700-normal.ttf"), fontWeight: 700 },
    ],
  });
  // Thai has no spaces between words, so react-pdf can only wrap at real
  // spaces and long cells overflow. Give the wrapper break points between
  // dictionary words — but only for Thai text; numbers/Latin stay whole
  // ("100.00%" must never split). react-pdf appends a "-" at a mid-word
  // break; Sarabun's Thai subset has no "-" (it drew a tofu box), so the
  // bundled Thai font maps "-" to an empty glyph, and the Latin font is listed
  // first in fontFamily so genuine hyphens in text still render from Latin.
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    Font.registerHyphenationCallback((word) =>
      /[\u0E00-\u0E7F]/.test(word) ? Array.from(seg.segment(word)).map((x) => x.segment) : [word]
    );
  }
  fontsReady = true;
}

// react-pdf's shaper decomposes sara am (U+0E33) into nikhahit + sara aa but
// keeps the character count of the run, so every sara am silently drops one
// glyph off the END of its text ("ประจำเดือน" -> "ประจำเดื"). Writing the
// decomposed pair ourselves (nikhahit first, then any tone mark, then sara aa
// — the order a shaper would emit) renders the same and avoids the mismatch.
const fixThai = (t: string) =>
  t.replace(/([\u0E48-\u0E4B])?\u0E33/g, (_m, tone: string | undefined) => `\u0E4D${tone ?? ""}\u0E32`);
const fixChildren = (c: React.ReactNode): React.ReactNode =>
  typeof c === "string" ? fixThai(c) : Array.isArray(c) ? c.map(fixChildren) : c;
function Text({ children, render, ...props }: React.PropsWithChildren<TextProps>) {
  if (render) {
    return <PdfText {...props} render={(a) => fixThai(String(render(a) ?? ""))} />;
  }
  return <PdfText {...props}>{fixChildren(children)}</PdfText>;
}

const INK = "#111111";
const MUTED = "#555555";
const LINE = "#999999";
const SHADE = "#eeeeee";

const s = StyleSheet.create({
  page: { fontFamily: ["SarabunLatin", "Sarabun"] as unknown as string, fontSize: 10, color: INK, paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, lineHeight: 1.35 },
  h1: { fontSize: 17, fontWeight: 700, textAlign: "center", lineHeight: 1.6, marginBottom: 2 },
  sub: { fontSize: 11, textAlign: "center", color: MUTED, lineHeight: 1.5 },
  period: { fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 8, marginBottom: 10 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 2 },
  note: { fontSize: 8.5, color: MUTED, marginTop: 3 },
  table: { borderTopWidth: 0.7, borderLeftWidth: 0.7, borderColor: LINE },
  tr: { flexDirection: "row" },
  th: { backgroundColor: SHADE, fontWeight: 700, borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: LINE, padding: 3, textAlign: "center", fontSize: 9 },
  td: { borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: LINE, padding: 3, fontSize: 9 },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  bold: { fontWeight: 700 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  sigBox: { width: "44%", alignItems: "center" },
  sigLine: { marginTop: 34, width: "100%", borderBottomWidth: 0.7, borderBottomColor: INK },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

const num = (n: number | null) => (n == null ? "-" : n.toLocaleString("en-US"));
const dec = (n: number | null, d = 1) => (n == null ? "-" : n.toFixed(d));
const sign = (n: number | null) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const mark = (st: Status) => (st === "pass" ? "ผ่าน" : st === "fail" ? "ไม่ผ่าน" : "-");

function Table({ widths, head, rows, boldRows = [], small = false }: {
  small?: boolean;
  widths: number[];
  head: string[];
  rows: { cells: string[]; align?: ("left" | "right" | "center")[]; bold?: boolean; fail?: boolean[] }[];
  boldRows?: number[];
}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const w = (i: number) => `${(widths[i] / total) * 100}%`;
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {head.map((h, i) => (
          <Text key={i} style={[s.th, { width: w(i) }, small ? { fontSize: 7.5, paddingHorizontal: 1.5 } : {}]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.tr} wrap={false}>
          {r.cells.map((c, i) => (
            <Text
              key={i}
              style={[
                s.td,
                { width: w(i) },
                small ? { fontSize: 7.5, paddingHorizontal: 1.5 } : {},
                r.align?.[i] === "right" ? s.right : r.align?.[i] === "center" ? s.center : {},
                r.bold || boldRows.includes(ri) || r.fail?.[i] ? s.bold : {},
              ]}
            >
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Simple greyscale bar chart (prints fine on a B/W printer). */
function Bars({ labels, values }: { labels: string[]; values: (number | null)[] }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const H = 80;
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: H + 14, borderBottomWidth: 0.7, borderColor: INK }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            {v != null && <Text style={{ fontSize: 6.5, color: MUTED }}>{v.toLocaleString("en-US")}</Text>}
            <View style={{ width: "62%", height: v == null ? 0 : Math.max(1, (v / max) * H), backgroundColor: "#555555" }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 7.5 }}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

function Signature({ role, p }: { role: string; p: { name: string; position: string } }) {
  return (
    <View style={s.sigBox} wrap={false}>
      <Text style={s.bold}>{role}</Text>
      <View style={s.sigLine} />
      <Text style={{ marginTop: 4 }}>ชื่อ - สกุล {p.name ? p.name : "........................................"}</Text>
      <Text style={{ marginTop: 2 }}>ตำแหน่ง {p.position ? p.position : "........................................"}</Text>
    </View>
  );
}

export function ReportDocument({ d }: { d: ReportData }) {
  ensureFonts();
  const att = d.attendance;
  const generated = new Date(d.generatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  return (
    <Document title={`${d.title} ${d.periodLabel}`} author="Blood collection unit">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{d.title}</Text>
        <Text style={s.sub}>หน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT โรงพยาบาลศรีนครินทร์</Text>
        <Text style={s.period}>{d.periodLabel}</Text>

        <Text style={s.h2} minPresenceAhead={70}>1. สรุปภาพรวม</Text>
        {d.autoNotes.map((n, i) => (
          <View key={i} style={s.bullet}>
            <Text style={{ width: 12 }}>•</Text>
            <Text style={{ flex: 1 }}>{n}</Text>
          </View>
        ))}
        <Text style={s.note}>
          ตัวชี้วัดคุณภาพ: ผ่าน {d.kpi.passed} · ไม่ผ่าน {d.kpi.failed} · ยังไม่มีข้อมูล/ไม่มีเกณฑ์ {d.kpi.unknown}
        </Text>

        <Text style={s.h2} minPresenceAhead={70}>2. จำนวนผู้รับบริการ</Text>
        <Table
          widths={[5, 2, 2, 2]}
          head={["จุดบริการ", "จำนวน (ราย)", `${d.compareLabel}`, "เปลี่ยนแปลง"]}
          rows={[
            ...att.byPoint.map((p) => ({
              cells: [p.point, num(p.total), num(p.prev), sign(p.pct)],
              align: ["left", "right", "right", "right"] as ("left" | "right")[],
            })),
            {
              cells: ["รวมทั้งหมด", num(att.total), num(att.prevTotal), sign(att.pct)],
              align: ["left", "right", "right", "right"],
              bold: true,
            },
          ]}
        />
        {att.byPoint.some((p) => p.types.length > 0) && (
          <>
            <Text style={[s.bold, { marginTop: 8, marginBottom: 3 }]}>แยกตามประเภทผู้รับบริการ</Text>
            <Table
              widths={[4, 3, 2]}
              head={["จุดบริการ", "ประเภท", "จำนวน (ราย)"]}
              rows={att.byPoint.flatMap((p) =>
                p.types.map((t) => ({
                  cells: [p.point, t.type, num(t.total)],
                  align: ["left", "left", "right"] as ("left" | "right")[],
                }))
              )}
            />
          </>
        )}

        {d.annual && (
          <View wrap={false}>
            <Text style={[s.bold, { marginTop: 10 }]}>จำนวนผู้รับบริการรายเดือน (รวมทุกจุดบริการ)</Text>
            <Bars labels={d.monthLabels} values={att.monthlyTotals} />
            <Text style={s.note}>เดือนที่ยังไม่มีข้อมูลไม่แสดงแท่งกราฟ (ไม่ใช่ศูนย์)</Text>
          </View>
        )}

        <Text style={s.h2} minPresenceAhead={70}>3. ระยะเวลาให้บริการ (TAT) {d.annual ? "เฉลี่ยของเดือนที่มีข้อมูล" : ""} หน่วย: นาที</Text>
        {d.tat.hasData ? (
          <Table
            widths={[4, ...d.tat.stages.map(() => 2)]}
            head={["จุดบริการ", ...d.tat.stages]}
            rows={d.tat.rows.map((r) => ({
              cells: [r.point, ...r.values.map((v) => dec(v))],
              align: ["left", ...r.values.map(() => "right" as const)],
            }))}
          />
        ) : (
          <Text>ไม่มีข้อมูล TAT ในช่วงเวลานี้</Text>
        )}

        <Text style={s.h2} minPresenceAhead={70}>4. ตัวชี้วัดคุณภาพ</Text>
        <Table
          widths={[4, 4, 1.6, 1.8, 1.4]}
          head={["ตัวชี้วัด", "เกณฑ์ประเมิน", "เป้าหมาย", d.annual ? "ผลรวมทั้งปี" : "ผลที่ได้", "สถานะ"]}
          rows={d.kpi.items.map((k) => ({
            cells: [k.name, k.criteria, k.target, k.value, mark(k.status)],
            align: ["left", "left", "center", "center", "center"] as ("left" | "center")[],
            fail: [false, false, false, k.status === "fail", k.status === "fail"],
          }))}
        />
        <Text style={s.note}>สถานะ “-” = ยังไม่มีข้อมูลหรือไม่มีเกณฑ์เป้าหมายให้เทียบ</Text>

        {d.annual && (
          <>
            <Text style={[s.h2, { marginTop: 14 }]} minPresenceAhead={70}>5. ผลตัวชี้วัดรายเดือน</Text>
            <Table
              small
              widths={[3.2, ...d.monthLabels.map(() => 1)]}
              head={["ตัวชี้วัด", ...d.monthLabels]}
              rows={d.kpi.items.map((k) => ({
                cells: [k.name, ...k.monthly.map((m) => (m.status === "fail" ? `${m.text}*` : m.text))],
                align: ["left", ...k.monthly.map(() => "center" as const)],
              }))}
            />
            <Text style={s.note}>* = ไม่ผ่านเกณฑ์ในเดือนนั้น</Text>
          </>
        )}

        <Text style={s.h2} minPresenceAhead={70}>{`${d.annual ? 6 : 5}. ข้อสังเกตและความเห็น`}</Text>
        {d.observations ? (
          <Text>{d.observations}</Text>
        ) : (
          <Text style={{ color: MUTED }}>-</Text>
        )}

        <View style={s.sigRow} wrap={false}>
          <Signature role="ผู้จัดทำ" p={d.preparer} />
          <Signature role="ผู้อนุมัติ" p={d.approver} />
        </View>

        <View style={s.footer} fixed>
          <Text>จัดทำเมื่อ {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `หน้า ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
