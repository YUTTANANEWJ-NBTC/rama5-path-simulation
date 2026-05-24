# Commute Traffic Simulation (Rama 5 ➔ NBTC Office)

## 📌 อธิบายโปรเจกต์ (Project Overview)
โปรเจกต์นี้คือ **Web Application สำหรับจำลองสถานการณ์การจราจร (Traffic Simulation)** บนแผนที่ 3 มิติ เพื่อวิเคราะห์เส้นทางการเดินทางจาก "บ้านแถวพระราม 5" ไปยัง "ที่ทำงาน สำนักงาน กสทช. (ซอยสายลม/พหลโยธิน)" 

แอปพลิเคชันถูกสร้างขึ้นเพื่อช่วยตัดสินใจในการเลือกเส้นทางและดูผลกระทบของปริมาณการจราจร โดยเฉพาะบริเวณที่มีจุดน่าสนใจ (POIs) เช่น โรงเรียน ตลาด และห้างสรรพสินค้า ซึ่งเป็นสาเหตุหลักของรถติด

---

## 🚀 ฟีเจอร์หลัก (Key Features)
แอปพลิเคชันมีรูปแบบการเดินทางให้เลือก 3 โหมด:
1. **Option 1 (Direct):** เส้นทางปกติ (ทางราบ) ที่คำนวณระยะทางสั้นที่สุด
2. **Option 2 (Expressway):** เส้นทางที่บังคับขึ้นทางด่วนพิเศษ (ด่านพระราม 5) และไปลงที่ทางลงจตุจักร
3. **Option 3 (Custom Interactive Route):** โหมดกำหนดเส้นทางเอง 
   - ผู้ใช้สามารถคลิกบนแผนที่เพื่อสร้าง Waypoints เป็นเส้นทางลัดเลาะตามใจชอบ
   - มีปุ่มสลับ **ขาไป (Outbound)** และ **ขากลับ (Return)**
   - ระบบจะไปดึงข้อมูลเส้นทางจริงจาก OSRM API แบบ Real-time

**ระบบการคำนวณและแสดงผล (Real-time Analytics):**
- **Traffic Delay Simulation:** รถ 1,500 คันในระบบจะ "ลดความเร็วลงอย่างสมจริง" หากวิ่งผ่านจุด POIs (โรงเรียน ตลาด ห้าง) เพื่อจำลองรถติด
- **Total Distance:** คำนวณระยะทางจริง (กิโลเมตร) ของเส้นทางที่เลือกด้วยสูตร Haversine
- **Estimated Travel Time:** (เฉพาะ Mode 3) มีการประเมินเวลาเดินทางเปรียบเทียบระหว่าง "ถนนโล่ง (Base Time)" กับ "รถติด (High Traffic)"

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend Framework:** React + Vite
- **Map & 3D Rendering:** `deck.gl` (TripsLayer, GeoJsonLayer, ScatterplotLayer) และ `maplibre-gl`
- **Routing Engine API:** OSRM (Open Source Routing Machine)
- **Icons:** `lucide-react`
- **Styling:** Vanilla CSS (Glassmorphism UI Concept)

---

## 📂 โครงสร้างไฟล์ที่สำคัญ (Important Files)
- `src/App.jsx` - ไฟล์หลักที่ควบคุม UI, แผนที่, การสลับโหมด, และการดึง OSRM API (Mode 3)
- `src/index.css` - สไตล์และหน้าตาของ Dashboard รวมถึงตัวควบคุมแกนเลื่อน (Sliders)
- `fetch_routes.mjs` - สคริปต์ Node.js สำหรับดึงข้อมูลเส้นทาง Mode 1 จาก OSRM และโหลด POI จาก Overpass API มาเซฟเป็นไฟล์ JSON
- `fetch_route2.mjs` - สคริปต์ Node.js สำหรับสร้างข้อมูลเส้นทาง Mode 2 (ขึ้นทางด่วน)
- `public/pois.json` - ตำแหน่งพิกัด โรงเรียน ตลาด ห้าง ในบริเวณเส้นทาง (ใช้ถ่วงความเร็วรถ)
- `public/trips.json` & `public/routes.geojson` - ข้อมูลพฤติกรรมรถวิ่งสำหรับ Mode 1
- `public/trips2.json` & `public/routes2.geojson` - ข้อมูลพฤติกรรมรถวิ่งสำหรับ Mode 2

---

## 💻 วิธีรันโปรเจกต์ (How to run)
1. เปิด Terminal ในโฟลเดอร์โปรเจกต์ (`d:\Google Antigravity\Project8_New_Home`)
2. รันคำสั่งเปิดเซิร์ฟเวอร์:
   ```bash
   npm run dev
   ```
3. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173/`

---

*สร้างและบันทึกไว้เพื่อให้ง่ายต่อการมาพัฒนาต่อในอนาคต สามารถอ่านไฟล์นี้เพื่อทำความเข้าใจ State ปัจจุบันของระบบก่อนเริ่มเขียนโค้ดต่อได้ทันที!*
