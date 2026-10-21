"use client";

import { useCallback, useState } from "react";
import { Users, Timer, ShieldCheck, FileText } from "lucide-react";
import { AttendanceEntryForm } from "@/components/entry/AttendanceEntryForm";
import { TatEntryForm } from "@/components/entry/TatEntryForm";
import { KpiEntryForm } from "@/components/entry/KpiEntryForm";
import { ReportDialog } from "@/components/entry/ReportDialog";

const TABS = [
  { id: "attendance", label: "จำนวนผู้รับบริการ", icon: Users },
  { id: "tat", label: "TAT (ระยะเวลาให้บริการ)", icon: Timer },
  { id: "kpi", label: "ตัวชี้วัดคุณภาพ", icon: ShieldCheck },
] as const;

export default function EntryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("attendance");
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);

  return (
    <div className="w-full space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-base-content sm:text-2xl">
            กรอกข้อมูลรายเดือน
          </h1>
          <p className="mt-1 text-sm text-base-content/50">
            จำนวนผู้รับบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
          </p>
        </div>
        <button onClick={() => setReportOpen(true)} className="btn btn-outline btn-sm gap-1.5">
          <FileText size={14} />
          สร้างรายงาน PDF
        </button>
      </div>

      <div role="tablist" className="tabs tabs-boxed glass-panel w-fit gap-1 !bg-transparent p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            onClick={() => setTab(id)}
            className={`tab gap-2 ${tab === id ? "tab-active" : ""}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "attendance" && <AttendanceEntryForm />}
      {tab === "tat" && <TatEntryForm />}
      {tab === "kpi" && <KpiEntryForm />}

      {reportOpen && <ReportDialog onClose={closeReport} />}
    </div>
  );
}
