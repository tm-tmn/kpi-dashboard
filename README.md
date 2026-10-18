# KPI Dashboard — หน่วยเจาะเลือด

เว็บแอป Next.js สำหรับแสดง Dashboard และกรอกข้อมูลรายเดือน โดยใช้ Google Sheet
เป็นฐานข้อมูล (ไม่ต้องตั้งเซิร์ฟเวอร์ฐานข้อมูลแยก)

- `/` — Dashboard สาธารณะ (ไม่ต้อง login) แสดงสรุป กราฟรายเดือน กราฟสัดส่วนแต่ละจุดบริการ และเทรนด์รายปี
- `/entry` — ฟอร์มกรอกข้อมูลรายเดือน บันทึกกลับเข้า Google Sheet โดยตรง

ดูขั้นตอนตั้งค่าทั้งหมด (Google Service Account, env vars, deploy ขึ้น Vercel)
ในไฟล์ **SETUP.md**

## รันทดสอบในเครื่อง

```bash
npm install
cp .env.local.example .env.local   # แล้วใส่ค่าให้ครบ (ดู SETUP.md)
npm run dev
```

เปิด http://localhost:3000

## โครงสร้างโค้ดที่ควรรู้

- `lib/constants.ts` — รายชื่อจุดบริการ/ประเภทผู้รับบริการ (ต้องตรงกับ Google Sheet เป๊ะ)
- `lib/sheets.ts` — ตัวเชื่อมต่อ Google Sheets API (อ่าน/เขียนชีต "ข้อมูลดิบ")
- `lib/aggregate.ts` — คำนวณสรุป/กราฟจากข้อมูลดิบ
- `lib/legacy-data.json` — ยอดรวมรายปี 2563-2568 (ไม่มีรายละเอียดแยกจุดบริการ จากไฟล์เดิม)
- `app/api/records/route.ts` — API: GET อ่านข้อมูลทั้งหมด, POST บันทึก 1 เดือน
