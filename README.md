# pocket-th-data — คำแปลภาษาไทยและข้อมูลการ์ด Pokémon TCG Pocket

ข้อมูลการ์ดและคำแปลภาษาไทยที่ใช้ในเว็บ **[Pocket TH](https://pokedex-th.slammer.work)** แปลท่าโจมตี ความสามารถ และผลการ์ดครบทุกใบ ส่วนชื่อโปเกมอนคงเป็นภาษาอังกฤษ

> แฟนโปรเจกต์ที่ไม่แสวงหากำไร ไม่มีส่วนเกี่ยวข้อง ไม่ได้รับการสนับสนุน หรือรับรองโดย Nintendo, The Pokémon Company, Creatures Inc., GAME FREAK inc. หรือ DeNA · Pokémon และชื่อตัวละครเป็นเครื่องหมายการค้าของเจ้าของ · คำแปลเป็นการแปลโดยแฟน ไม่ใช่ข้อความทางการ

## มีอะไรบ้าง

| ไฟล์ | คืออะไร |
|---|---|
| `i18n/th.json` | **คำแปล** — `names` คือชื่อท่า/ความสามารถ, `text` คือข้อความผลการ์ด |
| `scripts/build.mjs` | รวมข้อมูลการ์ดต้นทางกับคำแปล แล้วสร้าง `data/` |
| `data/cards.json` | ข้อมูลการ์ดพร้อมคำแปล (ที่เว็บใช้) |
| `data/og.json` | ดัชนีขนาดเล็กสำหรับภาพตัวอย่างตอนแชร์ลิงก์ |
| `i18n/missing.json` | รายการที่ยังไม่มีคำแปล (สร้างโดย build) |

ข้อมูลการ์ดต้นทางมาจาก [PocketDecks/pokemon-tcg-pocket-cards](https://github.com/PocketDecks/pokemon-tcg-pocket-cards) (AGPL-3.0-or-later)

## ช่วยแก้คำแปล

1. แก้ `i18n/th.json`
   - ข้อความใน `text` เขียนตัวเลขเป็น `{n}` ใส่ `{n}` ให้ **ครบจำนวนและเรียงลำดับเดียวกับต้นฉบับ** (ตัวเลขจะถูกเติมกลับตามลำดับ)
   - เก็บสัญลักษณ์พลังงานไว้ตามเดิม เช่น `[R]` `[W]` (เว็บจะแสดงเป็นไอคอน)
   - ชื่อท่าที่อ้างถึงในข้อความ (เช่น "ใช้ท่า Big Beat ไม่ได้") คงเป็นภาษาอังกฤษ
2. `npm install && npm run build && npm test`
3. เปิด Pull Request พร้อม `i18n/th.json` และ `data/` ที่ build แล้ว (CI จะตรวจให้)

ไม่สะดวกแก้เอง? กด **"แจ้งคำแปลผิด"** ในหน้าการ์ดบนเว็บได้เลย

## อภิธานศัพท์ (ใช้ให้ตรงกันทุกใบ)

| English | ไทย |
|---|---|
| Active Spot / Active Pokémon | ตำแหน่งต่อสู้ / โปเกมอนตัวต่อสู้ |
| Bench / Benched Pokémon | เบนช์ / โปเกมอนบนเบนช์ |
| Defending / Attacking Pokémon | โปเกมอนฝ่ายรับ / โปเกมอนที่โจมตี |
| do X damage / heal X damage | สร้างความเสียหาย X / ฟื้นฟู HP X |
| takes −X damage | ได้รับความเสียหาย…ลดลง X |
| Knocked Out | หมดสภาพ |
| Energy Zone / discard pile / deck / hand | โซนพลังงาน / กองทิ้ง / สำรับ / มือ |
| Retreat Cost / Weakness | ค่าถอย / จุดอ่อน |
| Asleep · Burned · Confused · Paralyzed · Poisoned | นอนหลับ · ติดไหม้ · สับสน · อัมพาต · ติดพิษ |
| Special Condition | สภาวะพิเศษ |
| Flip a coin. If heads / tails | ทอยเหรียญ 1 ครั้ง ถ้าออกหัว / ก้อย |
| Basic / Stage 1 / Stage 2 | ขั้นพื้นฐาน / ร่าง 1 / ร่าง 2 |
| Supporter · Item · Pokémon Tool · Stadium | ซัพพอร์ตเตอร์ · ไอเทม · เครื่องมือโปเกมอน · สเตเดียม |
| Pokémon Checkup | ช่วงตรวจเช็กโปเกมอน |
| Ultra Beast · Ancient · Future | อัลตร้าบีสต์ · โปเกมอนโบราณ · โปเกมอนอนาคต |

## เพิ่มชุดใหม่

1. อัปเดตเวอร์ชัน `pokemon-tcg-pocket-cards` ใน `package.json` แล้ว `npm install`
2. `npm run build` ข้อความใหม่ที่ยังไม่มีคำแปลจะอยู่ใน `i18n/missing.json`
3. แปลลง `i18n/th.json` จนกว่า `npm test` จะผ่าน แล้ว commit

## ใช้ข้อมูลนี้

ไฟล์ใน `data/` ใช้ได้ตรง ๆ เช่น `https://raw.githubusercontent.com/KSlammer/pocket-th-data/<commit>/data/cards.json` (แนะนำให้ระบุ commit แทน `main` เพื่อให้ข้อมูลไม่เปลี่ยนเอง)

## สัญญาอนุญาต

**AGPL-3.0-or-later** (ดู [LICENSE](LICENSE)) — เพราะสร้างต่อจากชุดข้อมูลต้นทางที่ใช้สัญญาเดียวกัน
