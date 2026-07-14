# U-Sabai Land System — ລະບົບຄຸ້ມຄອງໂຄງການດິນຈັດສັນ (ໄລຍະ 1)

Next.js + Supabase + Tailwind · ພາສາລາວ

## ຟີເຈີໄລຍະ 1

ເຂົ້າສູ່ລະບົບ (Supabase Auth) · ພາບລວມທຸກໂຄງການ + ແຈ້ງເຕືອນງວດຄ້າງຊຳລະ/ໃບຈອງກາຍກຳນົດ ·
ຜັງຕອນດິນ (ເພີ່ມ/ແກ້ໄຂ) · ລູກຄ້າ · ການຈອງ (ອອກໃບຈອງ + lock ຕອນດິນ) ·
ສັນຍາ (ຜ່ອນ 1/3/6 ເດືອນ, ຈ່າຍສົດກຳນົດງວດເອງ, ສ່ວນຫຼຸດ/ລາຄາຕົວຈິງ, ສ້າງຕາຕະລາງງວດອັດຕະໂນມັດ) ·
ຮັບເງິນ (ຄີຈຳນວນຈິງ, LAK/THB) · Import ຂໍ້ມູນຈາກ Excel

## ຂັ້ນຕອນຕິດຕັ້ງ

### 1. Supabase (ຄັ້ງດຽວ)
1. ສ້າງບັນຊີ https://supabase.com → New project (ເລືອກ region Singapore)
2. SQL Editor → ວາງເນື້ອໄຟລ໌ `01_ອອກແບບລະບົບ/USabai_Supabase_Schema.sql` → Run
3. Authentication → Users → Add user → ສ້າງບັນຊີພະນັກງານ (ອີເມວ + ລະຫັດຜ່ານ)
4. Settings → API → ຄັດລອກ Project URL ແລະ anon key

### 2. ຮັນໃນເຄື່ອງ (ຕ້ອງມີ Node.js 18+)
```bash
cd usabai-land-system
cp .env.example .env.local   # ຕື່ມຄ່າຈາກ Supabase
npm install
npm run dev                  # ເປີດ http://localhost:3000
```

### 3. Import ຂໍ້ມູນຈິງ (ຄັ້ງດຽວ)
```bash
# ຕື່ມ SUPABASE_SERVICE_ROLE_KEY ໃສ່ .env.local ກ່ອນ (Settings → API → service_role)
node scripts/import-excel.mjs "../../02_ຂໍ້ມູນລະບົບ/USabai_Data_2026_ປ້ອນຂໍ້ມູນຈິງ.xlsx"
```
ໝາຍເຫດ: ແຖວທີ່ໝາຍເຫດຂຶ້ນຕົ້ນດ້ວຍ "ຕົວຢ່າງ" ຈະຖືກຂ້າມ · ວັນທີທີ່ບໍ່ມີ = 1900-01-01 (ແກ້ໃນລະບົບພາຍຫຼັງ)

### 4. Deploy ຂຶ້ນ Vercel
1. ອັບໂຄດຂຶ້ນ GitHub (repo ໃໝ່ຊື່ `usabai-land-system`)
2. https://vercel.com → Import repo → ຕື່ມ Environment Variables 2 ຕົວ (URL + anon key)
3. Deploy — ໄດ້ URL ໃຫ້ທີມງານໃຊ້ທັນທີ

## ໄລຍະຕໍ່ໄປ
ໄລຍະ 2: ໃບຕາດິນ pipeline · ຕົ້ນທຶນ · PDF ອັດຕະໂນມັດ (ໃບຈອງ/ສັນຍາ/ໃບຮັບເງິນ/ໃບມອບຮັບ) · ອັບໂຫຼດເອກະສານລູກຄ້າ
ໄລຍະ 3: ສິດຜູ້ໃຊ້ລະອຽດ (RLS ຕໍ່ module) · ລາຍງານ + export Excel/PDF
