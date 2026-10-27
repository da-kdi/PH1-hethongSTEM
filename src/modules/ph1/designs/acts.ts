// @ts-nocheck
// Kho hoạt động — chép nguyên bộ chạy thử từ bản mẫu giao diện (ph1-chuong-trinh-mau.html): danh mục dạng bài (game hoá, mô phỏng 2D, giáo cụ ảo),
// bản chơi thử dựng chuỗi HTML cùng lớp CSS với bản mẫu (.dm, .race, .dm-flip…), cấu hình GV (cfgForm/readCfg). Dùng qua <ActDemo/> trong DesignsMau.tsx.
import { I } from '../mau/icons'
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const ic = (n, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] ?? ''}</svg>`
let toast = (_m: string) => {}
export const setActToast = (f: (m: string) => void) => { toast = f }
let usesOf = (_id: string) => 0
export const setActUses = (f: (id: string) => number) => { usesOf = f }

export const AKIND = { game: ['Game hoá', 'game', '#7c3aed'], sim: ['Mô phỏng 2D', 'atom', '#0e8fa8'], tool: ['Giáo cụ ảo', 'clip', '#2e6fd9'] }
// Hình minh hoạ (SVG nội tuyến, tông pastel)
export const ART = (() => {
  const g = (id, a, b) => `<radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`
  const sh = '<ellipse cx="80" cy="104" rx="38" ry="6" fill="#0f172a" opacity=".08"/>'
  const W = (defs, body) => `<svg viewBox="0 0 160 112" aria-hidden="true"><defs>${defs}</defs>${sh}${body}</svg>`
  return {
    trophy: W(g('g-trophy', '#ffe08a', '#e2a514'), '<path d="M52 26h56v14a28 28 0 0 1-56 0z" fill="url(#g-trophy)"/><path d="M52 32H40a12 12 0 0 0 14 16M108 32h12a12 12 0 0 1-14 16" fill="none" stroke="#e2a514" stroke-width="5"/><rect x="73" y="66" width="14" height="14" fill="#e2a514"/><rect x="60" y="80" width="40" height="12" rx="4" fill="url(#g-trophy)"/><circle cx="70" cy="44" r="3" fill="#7c4a03"/><circle cx="90" cy="44" r="3" fill="#7c4a03"/><path d="M72 53q8 7 16 0" stroke="#7c4a03" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="66" cy="16" r="5" fill="#f5c443"/><circle cx="80" cy="12" r="6" fill="#f5c443"/><circle cx="94" cy="16" r="5" fill="#f5c443"/>'),
    podium: W(g('g-podium', '#bfe3f7', '#5ba9d6'), '<rect x="62" y="40" width="36" height="54" rx="4" fill="url(#g-podium)"/><rect x="28" y="58" width="36" height="36" rx="4" fill="url(#g-podium)"/><rect x="96" y="66" width="36" height="28" rx="4" fill="url(#g-podium)"/><text x="80" y="34" text-anchor="middle" font-size="22" font-weight="800" fill="#f2b630">1</text><text x="46" y="82" text-anchor="middle" font-size="16" font-weight="800" fill="#f2b630">2</text><text x="114" y="86" text-anchor="middle" font-size="14" font-weight="800" fill="#f2b630">3</text>'),
    cards: W('', '<g transform="rotate(-24 80 70)"><rect x="56" y="26" width="40" height="56" rx="6" fill="#f9b4c8"/></g><g transform="rotate(-10 80 70)"><rect x="58" y="24" width="40" height="56" rx="6" fill="#a7d8f0"/></g><g transform="rotate(4 80 70)"><rect x="60" y="24" width="40" height="56" rx="6" fill="#b9e7b0"/></g><g transform="rotate(18 80 70)"><rect x="62" y="26" width="40" height="56" rx="6" fill="#fde39a"/><circle cx="82" cy="52" r="8" fill="#f59e0b"/></g>'),
    dna: W('', '<path d="M64 14c32 20 0 40 32 60s0 26 0 26" stroke="#7dd3e8" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M96 14c-32 20 0 40-32 60" stroke="#e2e8f0" stroke-width="9" fill="none" stroke-linecap="round"/><g stroke="#94a3b8" stroke-width="3"><path d="M70 24h20M74 44h12M70 64h20"/></g>'),
    claw: W(g('g-claw', '#ffffff', '#cbd5e1'), '<ellipse cx="80" cy="86" rx="34" ry="12" fill="url(#g-claw)"/><path d="M80 10v30" stroke="#7dd3e8" stroke-width="10" stroke-linecap="round"/><path d="M66 46q14-12 28 0l-4 16h-20z" fill="#7dd3e8"/><circle cx="80" cy="74" r="8" fill="#5bb8d6"/>'),
    tablet: W(g('g-tablet', '#cdeefa', '#7cc4e4'), '<rect x="34" y="24" width="92" height="64" rx="12" fill="url(#g-tablet)" transform="rotate(-8 80 56)"/><rect x="44" y="33" width="72" height="46" rx="6" fill="#eaf7fd" transform="rotate(-8 80 56)"/><path d="M72 46l18 10-18 10z" fill="#5bb8d6"/>'),
    puzzle: W('', '<path d="M38 46h18a8 8 0 1 1 14 0h10v18a8 8 0 1 0 0 14v12H38z" fill="#7dc4e0"/><path d="M80 34h12a8 8 0 1 1 14 0h16v40h-12a8 8 0 1 0-14 0H80V60a8 8 0 1 1 0-14z" fill="#f6b37a"/>'),
    wheel: W('', '<circle cx="80" cy="54" r="40" fill="#c4b5fd"/>' + ['#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a', '#ddd6fe', '#fecaca', '#a5f3fc', '#fef08a'].map((c, i) => { const a = i * Math.PI / 4, b = (i + 1) * Math.PI / 4; return `<path d="M80 54L${(80 + 34 * Math.cos(a)).toFixed(1)} ${(54 + 34 * Math.sin(a)).toFixed(1)}A34 34 0 0 1 ${(80 + 34 * Math.cos(b)).toFixed(1)} ${(54 + 34 * Math.sin(b)).toFixed(1)}z" fill="${c}"/>` }).join('') + '<circle cx="80" cy="54" r="7" fill="#fff"/>'),
    board: W(g('g-board', '#ffffff', '#dfe5ee'), '<rect x="32" y="46" width="96" height="40" rx="8" fill="url(#g-board)"/><g fill="#94a3b8">' + Array.from({ length: 24 }, (_, i) => `<circle cx="${42 + (i % 12) * 7}" cy="${56 + Math.floor(i / 12) * 10}" r="1.6"/>`).join('') + '</g><path d="M50 52c0-26 18-30 22-40M66 52c4-22 22-28 30-36M84 52c6-18 20-20 22-34" stroke="#f472b6" stroke-width="2.5" fill="none"/><circle cx="66" cy="76" r="2.4" fill="#334155"/><circle cx="94" cy="76" r="2.4" fill="#334155"/><path d="M74 78q6 5 12 0" stroke="#334155" stroke-width="2" fill="none"/>'),
    solar: W('', '<rect x="30" y="40" width="50" height="34" rx="4" fill="#5b8fd9" transform="skewX(-10)"/><g stroke="#cfe0fb" stroke-width="1.5"><path d="M38 57h46M50 40l-6 34M66 40l-6 34"/></g><path d="M112 30v56" stroke="#9ec9e8" stroke-width="5"/><g fill="#d6e6f5"><path d="M112 30l-6-22 6 2z"/><path d="M112 30l22 8-4 3z"/><path d="M112 30l-16 16 0-4z"/></g><path d="M92 18l-6 10h6l-4 10" stroke="#f5c443" stroke-width="3" fill="none"/>'),
    cradle: W('', '<path d="M40 26h80M44 26v58M116 26v58" stroke="#9ec9e8" stroke-width="5" stroke-linecap="round"/><rect x="36" y="84" width="88" height="8" rx="4" fill="#bcdcf2"/>' + [60, 72, 84, 96].map(x => `<path d="M${x} 26v40" stroke="#94a3b8" stroke-width="1.5"/><circle cx="${x}" cy="70" r="6" fill="#7aa7d6"/>`).join('') + '<path d="M48 26l-12 34" stroke="#94a3b8" stroke-width="1.5"/><circle cx="36" cy="64" r="6" fill="#7aa7d6"/>'),
    scope: W('', '<rect x="56" y="30" width="56" height="20" rx="10" fill="#7aa7d6" transform="rotate(-24 84 40)"/><path d="M80 52l-14 38M80 52l14 38M80 52v38" stroke="#f9a8b8" stroke-width="4" stroke-linecap="round"/><path d="M40 20a8 8 0 1 0 8 10a6 6 0 1 1-8-10z" fill="#fde68a"/><g fill="#fde68a"><circle cx="122" cy="24" r="3"/><circle cx="130" cy="64" r="2.5"/><circle cx="36" cy="60" r="2"/></g>'),
    gears: W(g('g-gears', '#f1f5f9', '#b7c2d0'), '<circle cx="64" cy="54" r="22" fill="url(#g-gears)" stroke="#b7c2d0" stroke-width="8" stroke-dasharray="6 5"/><circle cx="64" cy="54" r="7" fill="#e2e8f0"/><circle cx="102" cy="40" r="14" fill="#bcdcf2" stroke="#9ec9e8" stroke-width="6" stroke-dasharray="5 4"/><circle cx="102" cy="40" r="4" fill="#fff"/>'),
    abacus: W('', '<rect x="40" y="18" width="10" height="76" rx="4" fill="#64748b"/><rect x="110" y="18" width="10" height="76" rx="4" fill="#64748b"/><rect x="36" y="88" width="88" height="8" rx="4" fill="#475569"/>' + [[34, '#f472b6'], [52, '#facc15'], [70, '#4ade80']].map(([y, c]) => `<path d="M50 ${y}h60" stroke="#cbd5e1" stroke-width="2"/>` + [0, 1, 2, 3].map(i => `<rect x="${54 + i * 10}" y="${y - 6}" width="9" height="12" rx="4" fill="${c}"/>`).join('')).join('')),
    scale: W('', '<path d="M80 30v44" stroke="#9ec9e8" stroke-width="6"/><path d="M40 40h80" stroke="#bcdcf2" stroke-width="6" stroke-linecap="round" transform="rotate(-6 80 40)"/><ellipse cx="44" cy="44" rx="18" ry="5" fill="#cfe8f7"/><ellipse cx="116" cy="36" rx="18" ry="5" fill="#cfe8f7"/><g fill="#fde68a"><circle cx="38" cy="38" r="5"/><circle cx="48" cy="38" r="5"/></g><g fill="#c4b5fd"><circle cx="110" cy="30" r="5"/><circle cx="120" cy="30" r="5"/></g><rect x="64" y="74" width="32" height="18" rx="6" fill="#bcdcf2"/>'),
    flask: W(g('g-flask', '#bbf7d0', '#4ade80'), '<ellipse cx="80" cy="86" rx="36" ry="8" fill="#dbeafe"/><circle cx="80" cy="56" r="20" fill="url(#g-flask)"/><circle cx="73" cy="52" r="2.5" fill="#14532d"/><circle cx="87" cy="52" r="2.5" fill="#14532d"/><path d="M74 62q6 5 12 0" stroke="#14532d" stroke-width="2" fill="none"/><circle cx="54" cy="74" r="8" fill="#c4b5fd"/><circle cx="108" cy="74" r="8" fill="#f9a8d4"/><path d="M80 36V20" stroke="#cbd5e1" stroke-width="4"/>'),
    thermo: W('', '<rect x="72" y="12" width="16" height="70" rx="8" fill="#e2e8f0"/><rect x="77" y="34" width="6" height="50" rx="3" fill="#f87171"/><circle cx="80" cy="88" r="12" fill="#f87171"/><g stroke="#94a3b8" stroke-width="2"><path d="M92 24h8M92 36h6M92 48h8M92 60h6M92 72h8"/></g>'),
  }
})()

export const ACTS = [
  { id: 'HD-0001', kind: 'game', engine: 'race', art: 'trophy', title: 'Đường đua tri thức — An toàn điện', subj: ['Khoa học tự nhiên', 'Công nghệ'], grades: [6, 7, 8, 9], tags: ['Đua xe trả lời nhanh', 'An toàn điện', 'Khởi động'],
    play: 'Đường đua tri thức: An toàn điện mùa mưa bão', intro: 'Trả lời đúng và nhanh để về đích trước các đội bạn.', config: 'GV thay bộ câu hỏi, số làn đua (2–4), thời gian mỗi câu và tên đội theo bài mình dạy.',
    cfg: { time: 20, lanes: 3, qs: [['Khi thấy dây điện bị đứt rơi xuống đường, em nên làm gì?', 'Tránh xa và báo người lớn', 'Dùng que gỗ khô gạt ra', 'Nhặt lên để gọn lại'], ['Vật nào sau đây dẫn điện?', 'Chiếc thìa inox', 'Đôi dép nhựa', 'Thước gỗ'], ['Tay ướt có nên cắm sạc điện thoại không?', 'Không, dễ bị điện giật', 'Có, nếu nhanh tay', 'Chỉ khi pin yếu'],
      ['Khi có sấm sét, nơi nào an toàn hơn?', 'Trong nhà kín', 'Dưới gốc cây to', 'Giữa sân rộng'], ['Ổ cắm điện nên đặt ở đâu trong nhà có trẻ nhỏ?', 'Trên cao, có nắp che', 'Sát sàn nhà', 'Gần chậu nước'], ['Cầu dao/aptomat dùng để làm gì?', 'Tự ngắt điện khi quá tải', 'Tăng điện áp', 'Làm đèn sáng hơn']] } },
  { id: 'HD-0002', kind: 'game', engine: 'race', art: 'podium', title: 'Đường đua số — Phân số & tỉ lệ', subj: ['Toán'], grades: [6, 7], tags: ['Đua xe trả lời nhanh', 'Phân số', 'Luyện tập'],
    play: 'Đường đua số: Phân số & tỉ lệ', intro: 'Tính nhanh, chọn đúng để xe của đội vượt lên.', config: 'GV thay bộ câu hỏi, số làn đua (2–4) và thời gian mỗi câu.',
    cfg: { time: 25, lanes: 3, qs: [['1/2 + 1/4 = ?', '3/4', '2/6', '1/6'], ['Rút gọn 6/8', '3/4', '2/3', '6/4'], ['Tỉ số của 15 và 20 là', '3 : 4', '4 : 3', '15 : 4'], ['2/5 của 40 là', '16', '20', '8'], ['Số nào lớn nhất?', '5/6', '3/4', '2/3']] } },
  { id: 'HD-0003', kind: 'game', engine: 'flip', art: 'cards', title: 'Lật thẻ ghi nhớ — Linh kiện điện tử', subj: ['Công nghệ', 'Tin học'], grades: [8, 9], tags: ['Lật thẻ', 'Linh kiện', 'Ôn tập'],
    play: 'Lật thẻ: Linh kiện điện tử', intro: 'Bấm vào thẻ để lật xem công dụng của từng linh kiện.', config: 'GV sửa danh sách thẻ (mặt trước = mặt sau), thêm hình hoặc đổi số thẻ.',
    cfg: { pairs: [['Điện trở', 'Hạn chế dòng điện trong mạch'], ['Tụ điện', 'Tích và phóng điện, lọc nhiễu'], ['Đi-ốt', 'Cho dòng điện đi theo một chiều'], ['LED', 'Phát sáng khi có dòng điện thuận'], ['Tranzito', 'Khuếch đại hoặc đóng ngắt tín hiệu'], ['Cảm biến ánh sáng', 'Đổi cường độ sáng thành tín hiệu điện']] } },
  { id: 'HD-0004', kind: 'game', engine: 'flip', art: 'dna', title: 'Lật thẻ ghi nhớ — Tế bào & cơ thể sống', subj: ['Khoa học tự nhiên'], grades: [6, 7], tags: ['Lật thẻ', 'Tế bào', 'Ôn tập'],
    play: 'Lật thẻ: Tế bào & cơ thể sống', intro: 'Lật thẻ để nhớ chức năng các thành phần tế bào.', config: 'GV sửa danh sách thẻ (mặt trước = mặt sau).',
    cfg: { pairs: [['Màng tế bào', 'Bao bọc, kiểm soát chất ra vào'], ['Nhân tế bào', 'Chứa vật chất di truyền, điều khiển hoạt động'], ['Tế bào chất', 'Nơi diễn ra phần lớn hoạt động sống'], ['Lục lạp', 'Quang hợp ở tế bào thực vật'], ['Thành tế bào', 'Giúp tế bào thực vật cứng chắc']] } },
  { id: 'HD-0005', kind: 'game', engine: 'sort', art: 'claw', title: 'Nhiệm vụ phân loại — Dẫn điện hay cách điện?', subj: ['Khoa học tự nhiên', 'Công nghệ'], grades: [7, 8], tags: ['Kéo thả phân loại', 'Vật liệu', 'Vận dụng'],
    play: 'Phân loại: Dẫn điện hay cách điện?', intro: 'Kéo từng vật vào đúng nhóm, hoặc bấm vật rồi bấm nhóm.', config: 'GV đổi tên 2 nhóm và danh sách vật cần phân loại.',
    cfg: { bins: ['Dẫn điện', 'Cách điện'], items: [['Dây đồng', 0], ['Đinh sắt', 0], ['Giấy nhôm', 0], ['Than chì', 0], ['Cao su', 1], ['Nhựa', 1], ['Gỗ khô', 1], ['Thủy tinh', 1]] } },
  { id: 'HD-0006', kind: 'game', engine: 'sort', art: 'tablet', title: 'Nhiệm vụ phân loại — Rác tái chế xanh', subj: ['Khoa học tự nhiên', 'STEM sáng tạo'], grades: [6, 7], tags: ['Kéo thả phân loại', 'Môi trường'],
    play: 'Phân loại rác: tái chế hay không?', intro: 'Đưa mỗi loại rác vào đúng thùng.', config: 'GV đổi tên các thùng và danh sách rác.',
    cfg: { bins: ['Tái chế được', 'Rác hữu cơ'], items: [['Chai nhựa', 0], ['Lon nhôm', 0], ['Báo cũ', 0], ['Vỏ chuối', 1], ['Bã trà', 1], ['Hộp giấy', 0], ['Lá cây khô', 1]] } },
  { id: 'HD-0007', kind: 'game', engine: 'match', art: 'puzzle', title: 'Ghép cặp khái niệm — Máy cơ đơn giản', subj: ['Vật lý', 'Khoa học tự nhiên'], grades: [8, 9], tags: ['Ghép cặp', 'Máy cơ đơn giản'],
    play: 'Ghép cặp: Máy cơ đơn giản', intro: 'Bấm một khái niệm bên trái rồi bấm ví dụ phù hợp bên phải.', config: 'GV sửa danh sách cặp (khái niệm = ví dụ).',
    cfg: { pairs: [['Đòn bẩy', 'Cái bập bênh'], ['Ròng rọc cố định', 'Kéo cờ lên đỉnh cột'], ['Mặt phẳng nghiêng', 'Tấm ván dắt xe lên bậc'], ['Bánh xe và trục', 'Tay nắm vô lăng'], ['Nêm', 'Lưỡi rìu']] } },
  { id: 'HD-0008', kind: 'game', engine: 'wheel', art: 'wheel', title: 'Vòng quay may mắn — gọi tên học sinh', subj: ['Khoa học tự nhiên', 'Toán', 'Công nghệ', 'Tin học'], grades: [6, 7, 8, 9], tags: ['Vòng quay', 'Gọi tên', 'Mọi môn'],
    play: 'Vòng quay gọi tên', intro: 'Quay để chọn ngẫu nhiên học sinh trả lời.', config: 'GV dán danh sách lớp (mỗi dòng một tên).',
    cfg: { names: ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khoa', 'Linh', 'Minh', 'Nam', 'Phương'] } },
  { id: 'HD-0101', kind: 'sim', engine: 'series', art: 'board', title: 'Mô phỏng mạch điện nối tiếp', subj: ['Khoa học tự nhiên', 'Công nghệ'], grades: [7, 8], tags: ['Mạch điện', 'Định luật Ôm'],
    intro: 'Hai bóng đèn mắc nối tiếp: ngắt công tắc thấy cả mạch cùng tắt; đổi hiệu điện thế và điện trở để xem cường độ dòng điện và công suất thay đổi.', config: 'GV đặt giá trị ban đầu của hiệu điện thế và điện trở mỗi bóng.',
    cfg: { U: 7.3, R: 5.8 } },
  { id: 'HD-0102', kind: 'sim', engine: 'parallel', art: 'solar', title: 'Mô phỏng mạch điện song song', subj: ['Khoa học tự nhiên', 'Công nghệ'], grades: [7, 8], tags: ['Mạch điện', 'Song song'],
    intro: 'Hai bóng mắc song song: mỗi nhánh có công tắc riêng, tắt một bóng thì bóng kia vẫn sáng.', config: 'GV đặt giá trị ban đầu của hiệu điện thế và điện trở mỗi bóng.', cfg: { U: 6, R: 6 } },
  { id: 'HD-0103', kind: 'sim', engine: 'pendulum', art: 'cradle', title: 'Mô phỏng con lắc đơn', subj: ['Khoa học tự nhiên', 'Vật lý'], grades: [6, 9], tags: ['Dao động', 'Chu kỳ'],
    intro: 'Đổi chiều dài dây để thấy chu kỳ dao động thay đổi; khối lượng quả nặng không ảnh hưởng chu kỳ.', config: 'GV đặt chiều dài dây ban đầu.', cfg: { L: 1 } },
  { id: 'HD-0104', kind: 'sim', engine: 'orbit', art: 'scope', title: 'Mô phỏng Hệ Mặt Trời', subj: ['Khoa học tự nhiên'], grades: [6, 7], tags: ['Thiên văn', 'Hành tinh'],
    intro: 'Các hành tinh quay quanh Mặt Trời; bấm vào hành tinh để xem thông tin.', config: 'GV đặt tốc độ quay mặc định.', cfg: { speed: 1 } },
  { id: 'HD-0105', kind: 'sim', engine: 'lever', art: 'gears', title: 'Mô phỏng đòn bẩy cân bằng', subj: ['Vật lý', 'Khoa học tự nhiên'], grades: [8, 9], tags: ['Đòn bẩy', 'Mô-men lực'],
    intro: 'Đổi khối lượng và khoảng cách hai bên điểm tựa để đòn bẩy cân bằng: m₁·d₁ = m₂·d₂.', config: 'GV đặt khối lượng và khoảng cách ban đầu.', cfg: { m1: 3, d1: 4, m2: 2, d2: 5 } },
  { id: 'HD-0201', kind: 'tool', engine: 'ruler', art: 'abacus', title: 'Thước đo ảo 20 cm', subj: ['Khoa học tự nhiên', 'Toán'], grades: [6], tags: ['Đo độ dài', 'Thực hành'],
    intro: 'Chọn vật, đặt lên thước và đọc kết quả; nhập số đo để kiểm tra.', config: 'GV sửa danh sách vật cần đo (tên = độ dài cm).', cfg: { items: [['Bút chì', 14.5], ['Cục tẩy', 4.2], ['Kẹp giấy', 3.1], ['Chìa khoá', 6.8]] } },
  { id: 'HD-0202', kind: 'tool', engine: 'scale', art: 'scale', title: 'Cân điện tử ảo', subj: ['Khoa học tự nhiên'], grades: [6, 7], tags: ['Đo khối lượng', 'Thực hành'],
    intro: 'Đặt vật lên cân, dùng nút Trừ bì (TARE) để cân khối lượng vật trong hộp.', config: 'GV sửa danh sách vật (tên = khối lượng g).', cfg: { items: [['Quả táo', 182], ['Quả trứng', 58], ['Hộp bút', 245], ['Cốc nhựa (bì)', 35]] } },
  { id: 'HD-0203', kind: 'tool', engine: 'thermo', art: 'thermo', title: 'Nhiệt kế ảo', subj: ['Khoa học tự nhiên'], grades: [6, 8], tags: ['Đo nhiệt độ', 'Thực hành'],
    intro: 'Nhúng nhiệt kế vào từng cốc để đọc nhiệt độ; kéo thanh trượt để xem cột chất lỏng dâng lên.', config: 'GV sửa các mẫu đo (tên = °C).', cfg: { items: [['Nước đá đang tan', 0], ['Nước máy', 27], ['Thân nhiệt', 37], ['Nước sôi', 100]] } },
]
export const actOf = id => ACTS.find(a => a.id === id)
export const gradeTxt = gs => gs.length > 2 && gs[gs.length - 1] - gs[0] === gs.length - 1 ? `THCS ${gs[0]}–${gs[gs.length - 1]}` : gs.map(g => 'THCS ' + g).join(' · ')
export const actUses = id => usesOf(id)

// ---------- Bản chơi thử / chạy trong bài giảng ----------
export const DM = {}, DMK = {}, DMT = {}
export const clone = o => JSON.parse(JSON.stringify(o))
const rot = (arr, k) => arr.map((_, i) => arr[(i + k) % arr.length])
function dmState(key, a, cfg) {
  if (DM[key]) return DM[key]
  const e = a.engine
  return DM[key] = e === 'race' ? { phase: 'ready', i: 0, score: 0, streak: 0, best: 0, pos: Array(cfg.lanes).fill(0), pick: null, t: cfg.time }
    : e === 'flip' ? { open: [] } : e === 'sort' ? { place: {}, sel: null, checked: false } : e === 'match' ? { sel: null, done: {}, bad: null }
    : e === 'wheel' ? { rot: 0, picked: null, spinning: false } : e === 'series' || e === 'parallel' ? { U: cfg.U, R: cfg.R, on: true, on2: true }
    : e === 'pendulum' ? { L: cfg.L } : e === 'orbit' ? { speed: cfg.speed, sel: 2 } : e === 'lever' ? { ...cfg } : e === 'ruler' ? { k: 0, ans: '', res: null } : e === 'scale' ? { on: [], tare: 0 } : e === 'thermo' ? { T: 25, k: null } : {}
}
const TEAMS = ['Đội của em', 'Đội Xanh', 'Đội Cam', 'Đội Hồng']
const PLANETS = [['Sao Thuỷ', 0.39, 88, '#a8a29e', 3], ['Sao Kim', 0.72, 225, '#fbbf24', 4.5], ['Trái Đất', 1, 365, '#38bdf8', 5], ['Sao Hoả', 1.52, 687, '#f87171', 4], ['Sao Mộc', 5.2, 4333, '#fdba74', 9], ['Sao Thổ', 9.5, 10759, '#fde68a', 8]]
function dmOut(key) {
  const { a, cfg } = DMK[key]; const s = dmState(key, a, cfg); const e = a.engine; const f = (n, d = 2) => Number(n).toFixed(d)
  if (e === 'series' || e === 'parallel') {
    const par = e === 'parallel'; const b1 = s.on && (par ? true : s.on2 !== false), b2 = par ? s.on && s.on2 : b1
    const Ib = s.R ? s.U / (par ? s.R : 2 * s.R) : 0; const I = !s.on ? 0 : par ? (s.on2 ? 2 : 1) * s.U / s.R : Ib; const P = s.on ? Ib * Ib * s.R : 0
    const bulb = (x, y, on) => `<g transform="translate(${x} ${y})"><circle r="26" fill="#fde047" opacity="${on ? Math.min(.85, .2 + P / 4) : 0}" filter="url(#glow)"/><circle r="14" fill="${on ? '#fde68a' : '#e5e7eb'}" stroke="#b45309" stroke-width="2"/><path d="M-6 4l3-8 3 6 3-6 3 8" stroke="#b45309" stroke-width="1.6" fill="none"/><rect x="-6" y="14" width="12" height="6" rx="1.5" fill="#94a3b8"/><text y="38" text-anchor="middle" font-size="11" font-weight="700" fill="#b45309">${on ? f(P) + ' W' : 'tắt'}</text></g>`
    const svg = par
      ? `<path d="M60 40H330V200H60z" fill="none" stroke="#334155" stroke-width="4"/><path d="M60 120H330" stroke="#334155" stroke-width="4"/>${bulb(150, 40, s.on)}${bulb(150, 120, s.on && s.on2)}<g transform="translate(250 120)"><circle cx="-12" r="4" fill="#334155"/><circle cx="12" r="4" fill="#334155"/><path d="M-12 0 L12 ${s.on2 ? 0 : -12}" stroke="#334155" stroke-width="4"/></g><text x="250" y="145" text-anchor="middle" font-size="11" fill="#64748b">K₂: ${s.on2 ? 'ĐÓNG' : 'MỞ'}</text>`
      : `<path d="M60 40H330V200H60z" fill="none" stroke="#334155" stroke-width="4"/>${bulb(150, 40, s.on)}${bulb(250, 40, s.on)}`
    return `<div class="dm-circ"><span class="dm-badge ${s.on ? 'on' : ''}">${s.on ? 'Mạch đang kín' : 'Mạch hở'}</span><svg viewBox="0 0 390 235" role="img" aria-label="Sơ đồ mạch"><defs><filter id="glow"><feGaussianBlur stdDeviation="6"/></filter></defs>
      <text x="80" y="22" font-size="13" font-weight="800" fill="#dc2626">I qua nguồn = ${f(I)} A ${s.on ? '→' : ''}</text>${svg}
      <rect x="100" y="188" width="40" height="24" fill="var(--surface)"/><path d="M112 186v28M126 192v16" stroke="#334155" stroke-width="4"/><text x="120" y="230" text-anchor="middle" font-size="12" fill="#64748b">${f(s.U, 1)} V</text>
      <rect x="200" y="190" width="70" height="20" fill="var(--surface)"/><circle cx="212" cy="200" r="4" fill="#334155"/><circle cx="258" cy="200" r="4" fill="#334155"/><path d="M212 200 L258 ${s.on ? 200 : 184}" stroke="#334155" stroke-width="4"/><text x="235" y="228" text-anchor="middle" font-size="11" fill="#64748b">K${par ? '₁' : ''}: ${s.on ? 'ĐÓNG' : 'MỞ'}</text></svg>
      <div class="dm-kpis"><div><small>Hiệu điện thế</small><b>${f(s.U, 1)} V</b></div><div><small>Điện trở/bóng</small><b>${f(s.R, 1)} Ω</b></div><div><small>Dòng qua nguồn</small><b>${f(I)} A</b></div><div><small>Công suất/bóng</small><b class="hl">${f(P)} W</b></div></div></div>`
  }
  if (e === 'pendulum') { const T = 2 * Math.PI * Math.sqrt(s.L / 9.8); const len = 40 + s.L * 70
    return `<div class="dm-pend"><svg viewBox="0 0 300 240" role="img" aria-label="Con lắc"><path d="M90 16h120" stroke="#64748b" stroke-width="6" stroke-linecap="round"/><g class="swing" style="animation-duration:${f(T / 2)}s"><path d="M150 18V${18 + len}" stroke="#475569" stroke-width="2"/><circle cx="150" cy="${18 + len}" r="13" fill="#7aa7d6"/></g></svg>
      <div class="dm-kpis"><div><small>Chiều dài dây</small><b>${f(s.L)} m</b></div><div><small>Chu kỳ T = 2π√(l/g)</small><b class="hl">${f(T)} s</b></div><div><small>Tần số</small><b>${f(1 / T)} Hz</b></div><div><small>Dao động trong 10 s</small><b>${f(10 / T, 1)}</b></div></div></div>` }
  if (e === 'orbit') { const p = PLANETS[s.sel]
    return `<div class="dm-orbit"><div class="sky" style="--sp:${s.speed}"><span class="osun"></span>${PLANETS.map(([n, au, d, c, r], i) => `<span class="orb" style="--d:${36 + i * 22}px;--t:${(Math.sqrt(d) / 3 / s.speed).toFixed(2)}s;animation-delay:-${(Math.sqrt(d) / 3 / s.speed * ((i * 0.37) % 1)).toFixed(2)}s"><button type="button" class="pl ${i === s.sel ? 'on' : ''}" style="--c:${c};--r:${r * 2}px" data-dm="${key}|planet|${i}" aria-label="${n}"></button></span>`).join('')}</div>
      <div class="dm-kpis"><div><small>Hành tinh</small><b>${p[0]}</b></div><div><small>Cách Mặt Trời</small><b>${p[1]} AU</b></div><div><small>Một vòng quanh Mặt Trời</small><b class="hl">${p[2].toLocaleString('vi-VN')} ngày</b></div><div><small>Tốc độ xem</small><b>×${s.speed}</b></div></div></div>` }
  if (e === 'lever') { const L = s.m1 * s.d1, R = s.m2 * s.d2; const ang = Math.max(-14, Math.min(14, (R - L) * 1.2)); const ok = L === R
    return `<div class="dm-lever"><svg viewBox="0 0 320 170" role="img" aria-label="Đòn bẩy"><g transform="rotate(${ang} 160 100)"><rect x="20" y="94" width="280" height="10" rx="5" fill="#94a3b8"/>
      <g transform="translate(${160 - s.d1 * 13} 94)"><rect x="-14" y="${-12 - s.m1 * 4}" width="28" height="${12 + s.m1 * 4}" rx="4" fill="#7aa7d6"/><text y="${-16 - s.m1 * 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${s.m1} kg</text></g>
      <g transform="translate(${160 + s.d2 * 13} 94)"><rect x="-14" y="${-12 - s.m2 * 4}" width="28" height="${12 + s.m2 * 4}" rx="4" fill="#f6b37a"/><text y="${-16 - s.m2 * 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${s.m2} kg</text></g></g>
      <path d="M160 104l-16 40h32z" fill="#64748b"/><text x="160" y="164" text-anchor="middle" font-size="12" fill="#64748b">điểm tựa</text></svg>
      <div class="dm-kpis"><div><small>Bên trái m₁·d₁</small><b>${L}</b></div><div><small>Bên phải m₂·d₂</small><b>${R}</b></div><div><small>Trạng thái</small><b class="${ok ? 'good' : 'hl'}">${ok ? 'Cân bằng' : L > R ? 'Lệch trái' : 'Lệch phải'}</b></div></div></div>` }
  if (e === 'thermo') { const h = Math.max(0, Math.min(1, (s.T + 10) / 120))
    return `<div class="dm-thermo"><svg viewBox="0 0 120 240" role="img" aria-label="Nhiệt kế"><rect x="48" y="10" width="24" height="190" rx="12" fill="var(--soft)" stroke="#cbd5e1"/><rect x="55" y="${190 - h * 170}" width="10" height="${h * 170 + 14}" rx="5" fill="#ef4444"/><circle cx="60" cy="212" r="18" fill="#ef4444"/>
      ${[-10, 0, 20, 40, 60, 80, 100].map(t => { const y = 190 - (t + 10) / 120 * 170; return `<path d="M74 ${y}h10" stroke="#94a3b8"/><text x="88" y="${y + 4}" font-size="10" fill="#64748b">${t}</text>` }).join('')}</svg>
      <div class="dm-kpis col"><div><small>Nhiệt độ đọc được</small><b class="hl">${f(s.T, 1)} °C</b></div><div><small>Đổi sang °F</small><b>${f(s.T * 9 / 5 + 32, 1)} °F</b></div><div><small>Mẫu đang đo</small><b>${s.k == null ? 'Tự chỉnh' : esc(cfg.items[s.k][0])}</b></div></div></div>` }
  return ''
}
export function actDemo(a, cfg, key) {
  DMK[key] = { a, cfg }; const s = dmState(key, a, cfg); const e = a.engine; const K = key
  const head = a.kind === 'game' ? `<div class="dm-top"><span class="dm-ic">${ic('game')}</span><div><small>GAME HOÁ LỚP HỌC</small><b>${esc(a.play || a.title)}</b></div><span class="dm-type">${esc(a.tags[0])}</span></div><p class="dm-intro">${esc(a.intro)}</p>` : ''
  const reset = `<button type="button" class="btn sm ghost" data-dm="${K}|reset">${ic('refresh')} Đặt lại</button>`
  let body = ''
  if (e === 'race') { const n = cfg.qs.length; const q = cfg.qs[s.i]; const opts = q ? rot(q.slice(1), s.i % (q.length - 1)) : []; const right = q ? opts.indexOf(q[1]) : -1
    const lanes = s.pos.map((p, i) => `<div class="lane"><span class="team t${i}">${TEAMS[i]}</span><div class="road"><span class="car t${i}" style="left:calc(${(p / n) * 100}% * .9)"><svg viewBox="0 0 40 20" aria-hidden="true"><rect x="2" y="6" width="32" height="9" rx="4"/><path d="M10 6l5-5h9l5 5z" opacity=".8"/><circle cx="10" cy="16" r="3.5" fill="#1f2937"/><circle cx="27" cy="16" r="3.5" fill="#1f2937"/></svg></span><i class="flag"></i></div><b>${p}</b></div>`).join('')
    const done = s.phase === 'done'; const rank = 1 + s.pos.slice(1).filter(p => p > s.pos[0]).length
    body = `<div class="dm-stats"><div class="st1"><small>Câu hỏi</small><b>${Math.min(s.i + 1, n)}/${n}</b></div><div class="st2"><small>Điểm</small><b>${s.score}</b></div><div class="st3"><small>Chuỗi đúng</small><b>${s.streak || '–'}</b></div><div class="st4"><small>Về đích</small><b>${s.pos[0]}/${n}</b></div><div class="st5"><small>Thời gian</small><b id="dmt-${K}">${s.phase === 'q' && s.pick == null ? s.t + 's' : '–'}</b></div></div>
      <div class="race"><div class="scene"><i class="sun"></i><i class="cloud c1"></i><i class="cloud c2"></i><i class="tree" style="left:12%"></i><i class="tree" style="left:46%"></i><i class="tree" style="left:78%"></i></div><div class="track">${lanes}</div></div>
      ${s.phase === 'ready' ? `<div class="dm-cta"><button type="button" class="btn primary" data-dm="${K}|start">${ic('play')} Bắt đầu đua</button><small>${n} câu · ${cfg.time} giây/câu · ${cfg.lanes} làn</small></div>`
      : done ? `<div class="dm-result"><b>${rank === 1 ? '🏆 Đội của em về nhất!' : 'Đội của em về hạng ' + rank}</b><span>${s.score} điểm · chuỗi đúng dài nhất ${s.best}</span>${reset}</div>`
      : `<div class="dm-q"><b>${esc(q[0])}</b><div class="opts">${opts.map((o, i) => `<button type="button" class="opt ${s.pick != null && i === right ? 'right' : ''} ${s.pick === i && i !== right ? 'wrong' : ''}" data-dm="${K}|ans|${i}" ${s.pick != null ? 'disabled' : ''}><span class="ol">${'ABCD'[i]}</span>${esc(o)}</button>`).join('')}</div>
        ${s.pick != null ? `<div class="dm-fb ${s.pick === right ? 'ok' : 'no'}"><span>${s.pick === right ? 'Chính xác! Xe tiến 1 ô.' : s.pick === -1 ? 'Hết giờ!' : 'Chưa đúng — đáp án ' + 'ABCD'[right] + '.'}</span><button type="button" class="btn sm primary" data-dm="${K}|next">${s.i + 1 < n ? 'Câu tiếp' : 'Xem kết quả'}</button></div>` : ''}</div>`}`
  }
  if (e === 'flip') body = `<div class="dm-flip">${cfg.pairs.map(([fr, bk], i) => `<button type="button" class="fcard ${s.open.includes(i) ? 'on' : ''}" data-dm="${K}|flip|${i}" aria-pressed="${s.open.includes(i)}"><span class="fr">${esc(fr)}</span><span class="bk">${esc(bk)}</span></button>`).join('')}</div>
    <div class="dm-bar"><small>Đã lật ${s.open.length}/${cfg.pairs.length} thẻ</small><button type="button" class="btn sm" data-dm="${K}|flipall">${s.open.length === cfg.pairs.length ? 'Úp tất cả' : 'Lật tất cả'}</button></div>`
  if (e === 'sort') { const pool = cfg.items.map((x, i) => i).filter(i => s.place[i] == null); const ok = cfg.items.filter((x, i) => s.place[i] === x[1]).length
    const chip = i => `<button type="button" draggable="true" class="sitem ${s.sel === i ? 'sel' : ''} ${s.checked && s.place[i] != null ? (s.place[i] === cfg.items[i][1] ? 'right' : 'wrong') : ''}" data-dm="${K}|sel|${i}" data-dmdrag="${K}|${i}">${esc(cfg.items[i][0])}</button>`
    body = `<div class="dm-pool" data-dmbin="${K}|-1">${pool.map(chip).join('') || '<small>Đã xếp hết — bấm Kiểm tra.</small>'}</div>
      <div class="dm-bins">${cfg.bins.map((b, j) => `<div class="bin b${j}" data-dmbin="${K}|${j}" data-dm="${K}|put|${j}" role="button" tabindex="0"><b>${esc(b)}</b><div>${cfg.items.map((x, i) => i).filter(i => s.place[i] === j).map(chip).join('')}</div></div>`).join('')}</div>
      <div class="dm-bar"><small>${s.checked ? `Đúng ${ok}/${cfg.items.length}` : s.sel != null ? 'Bấm vào nhóm để đặt “' + esc(cfg.items[s.sel][0]) + '”' : 'Kéo thả, hoặc bấm vật rồi bấm nhóm'}</small><span><button type="button" class="btn sm primary" data-dm="${K}|check">Kiểm tra</button>${reset}</span></div>` }
  if (e === 'match') { const R = rot(cfg.pairs.map((_, i) => i), 2).reverse(); const nd = Object.keys(s.done).length
    body = `<div class="dm-match"><div>${cfg.pairs.map(([l], i) => `<button type="button" class="mitem ${s.done[i] != null ? 'done' : ''} ${s.sel === i ? 'sel' : ''}" data-dm="${K}|ml|${i}" ${s.done[i] != null ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>
      <div>${R.map(j => { const used = Object.values(s.done).includes(j); return `<button type="button" class="mitem r ${used ? 'done' : ''} ${s.bad === j ? 'wrong' : ''}" data-dm="${K}|mr|${j}" ${used ? 'disabled' : ''}>${esc(cfg.pairs[j][1])}</button>` }).join('')}</div></div>
      <div class="dm-bar"><small>${nd === cfg.pairs.length ? '🎉 Ghép đúng tất cả!' : `Đã ghép ${nd}/${cfg.pairs.length}`}</small>${reset}</div>` }
  if (e === 'wheel') { const n = cfg.names.length; const cols = ['#fbcfe8', '#bae6fd', '#bbf7d0', '#fde68a', '#ddd6fe', '#fecaca', '#a5f3fc', '#fef08a']
    const grad = cfg.names.map((_, i) => `${cols[i % cols.length]} ${(i * 360 / n).toFixed(2)}deg ${((i + 1) * 360 / n).toFixed(2)}deg`).join(',')
    body = `<div class="dm-wheel"><div class="wwrap"><i class="ptr"></i><div class="wheel" id="wh-${K}" style="background:conic-gradient(${grad});transform:rotate(${s.rot}deg)">${cfg.names.map((nm, i) => `<span style="transform:rotate(${(i + .5) * 360 / n}deg)"><em>${esc(nm)}</em></span>`).join('')}</div></div>
      <div class="wside"><small>Người được chọn</small><b class="wpick">${s.picked != null ? esc(cfg.names[s.picked]) : '—'}</b><button type="button" class="btn primary" data-dm="${K}|spin" ${s.spinning ? 'disabled' : ''}>${ic('refresh')} Quay</button><small>${n} tên trong danh sách</small></div></div>` }
  const rng = (k, lab, min, max, step, unit) => `<label class="dm-rng"><span>${lab}<b>${Number(s[k]).toFixed(step < 1 ? (step < .1 ? 2 : 1) : 0)} ${unit}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-dmr="${K}|${k}" aria-label="${lab}"></label>`
  if (e === 'series' || e === 'parallel') body = `<div class="dm-out">${dmOut(K)}</div><div class="dm-ctl">${rng('U', 'Hiệu điện thế nguồn', 1, 12, .1, 'V')}${rng('R', 'Điện trở mỗi bóng', 1, 20, .1, 'Ω')}</div>
    <div class="dm-bar"><span><button type="button" class="btn sm ${s.on ? 'good' : ''}" data-dm="${K}|sw">${s.on ? 'Ngắt công tắc' : 'Đóng công tắc'}</button>${e === 'parallel' ? `<button type="button" class="btn sm" data-dm="${K}|sw2">${s.on2 ? 'Mở K₂' : 'Đóng K₂'}</button>` : ''}${reset}</span></div>`
  if (e === 'pendulum') body = `<div class="dm-out">${dmOut(K)}</div><div class="dm-ctl">${rng('L', 'Chiều dài dây', .2, 2, .05, 'm')}</div><div class="dm-bar"><small>Kéo chiều dài lên gấp 4 lần thì chu kỳ tăng gấp đôi.</small>${reset}</div>`
  if (e === 'orbit') body = `<div class="dm-out">${dmOut(K)}</div><div class="dm-ctl">${rng('speed', 'Tốc độ xem', .25, 4, .25, '×')}</div>`
  if (e === 'lever') body = `<div class="dm-out">${dmOut(K)}</div><div class="dm-ctl g2">${rng('m1', 'Khối lượng trái m₁', 1, 6, 1, 'kg')}${rng('d1', 'Khoảng cách d₁', 1, 10, 1, 'ô')}${rng('m2', 'Khối lượng phải m₂', 1, 6, 1, 'kg')}${rng('d2', 'Khoảng cách d₂', 1, 10, 1, 'ô')}</div><div class="dm-bar"><small>Thử tìm 2 cách khác nhau để cân bằng.</small>${reset}</div>`
  if (e === 'thermo') body = `<div class="dm-out">${dmOut(K)}</div><div class="dm-chips">${cfg.items.map(([n, t], i) => `<button type="button" class="btn sm ${s.k === i ? 'primary' : ''}" data-dm="${K}|tk|${i}">${esc(n)}</button>`).join('')}</div><div class="dm-ctl">${rng('T', 'Nhiệt độ', -10, 110, .5, '°C')}</div>`
  if (e === 'ruler') { const it = cfg.items[s.k]; const px = 28
    body = `<div class="dm-chips">${cfg.items.map(([n], i) => `<button type="button" class="btn sm ${s.k === i ? 'primary' : ''}" data-dm="${K}|rk|${i}">${esc(n)}</button>`).join('')}</div>
      <div class="dm-ruler"><svg viewBox="0 0 ${20 * px + 40} 110" role="img" aria-label="Thước 20 cm"><rect x="${20 + 0}" y="20" width="${it[1] * px}" height="22" rx="8" fill="#f6b37a"/><text x="${20 + it[1] * px / 2}" y="35" text-anchor="middle" font-size="12" font-weight="700" fill="#7c2d12">${esc(it[0])}</text>
        <rect x="10" y="50" width="${20 * px + 20}" height="52" rx="6" fill="#fef3c7" stroke="#e5c07b"/>${Array.from({ length: 201 }, (_, i) => `<path d="M${20 + i * px / 10} 50v${i % 10 ? (i % 5 ? 8 : 13) : 20}" stroke="#78350f" stroke-width="${i % 10 ? .7 : 1.4}"/>`).join('')}${Array.from({ length: 21 }, (_, i) => `<text x="${20 + i * px}" y="86" text-anchor="middle" font-size="11" fill="#78350f">${i}</text>`).join('')}</svg></div>
      <div class="dm-bar"><label class="dm-inp">Em đo được <input type="number" step="0.1" value="${esc(s.ans)}" data-dmv="${K}|ans" aria-label="Số đo"> cm</label><span><button type="button" class="btn sm primary" data-dm="${K}|rcheck">Kiểm tra</button></span>
        ${s.res != null ? `<small class="${s.res ? 'good' : 'bad'}">${s.res ? 'Chính xác: ' + it[1] + ' cm' : 'Chưa đúng — đọc lại vạch mm nhé.'}</small>` : ''}</div>` }
  if (e === 'scale') { const tot = s.on.reduce((x, i) => x + cfg.items[i][1], 0) - s.tare
    body = `<div class="dm-scale"><div class="plate">${s.on.map(i => `<span class="obj">${esc(cfg.items[i][0])}</span>`).join('') || '<small>Đặt vật lên cân</small>'}</div><div class="lcd"><b>${tot.toFixed(0)}</b><small>g</small></div></div>
      <div class="dm-chips">${cfg.items.map(([n, g], i) => `<button type="button" class="btn sm ${s.on.includes(i) ? 'primary' : ''}" data-dm="${K}|sk|${i}">${s.on.includes(i) ? '− ' : '+ '}${esc(n)}</button>`).join('')}</div>
      <div class="dm-bar"><small>${s.tare ? `Đã trừ bì ${s.tare} g` : 'Đặt hộp/cốc rồi bấm Trừ bì để chỉ cân vật bên trong'}</small><span><button type="button" class="btn sm" data-dm="${K}|tare">Trừ bì (TARE)</button>${reset}</span></div>` }
  return `<div class="dm k-${a.kind}" data-demo="${K}">${head}${a.kind !== 'game' ? `<p class="dm-intro">${esc(a.intro)}</p>` : ''}${body}</div>`
}
function dmRedraw(key) { const el = document.querySelector(`[data-demo="${CSS.escape(key)}"]`); if (!el) return; const { a, cfg } = DMK[key]; el.outerHTML = actDemo(a, cfg, key) }
function dmTimer(key) { clearInterval(DMT[key]); const { cfg } = DMK[key]
  DMT[key] = setInterval(() => { const s = DM[key]; const el = document.getElementById('dmt-' + key)
    if (!el || !s || s.phase !== 'q' || s.pick != null) return clearInterval(DMT[key])
    s.t--; el.textContent = s.t + 's'; if (s.t <= 0) { clearInterval(DMT[key]); dmAct(key, 'ans', -1) } }, 1000) }
function dmAct(key, op, arg) {
  const { a, cfg } = DMK[key] ?? {}; if (!a) return; const s = DM[key]; const i = +arg
  if (op === 'reset') { clearInterval(DMT[key]); delete DM[key] }
  else if (a.engine === 'race') {
    if (op === 'start') { s.phase = 'q'; s.t = cfg.time }
    if (op === 'ans' && s.pick == null) { clearInterval(DMT[key]); const q = cfg.qs[s.i]; const right = rot(q.slice(1), s.i % (q.length - 1)).indexOf(q[1])
      s.pick = i; if (i === right) { s.pos[0]++; s.streak++; s.best = Math.max(s.best, s.streak); s.score += 10 + Math.round(s.t / 2) } else s.streak = 0
      s.pos = s.pos.map((p, k) => k && Math.random() < .55 ? p + 1 : p) }
    if (op === 'next') { s.i++; s.pick = null; s.t = cfg.time; if (s.i >= cfg.qs.length) s.phase = 'done' }
  }
  else if (op === 'flip') s.open = s.open.includes(i) ? s.open.filter(x => x !== i) : [...s.open, i]
  else if (op === 'flipall') s.open = s.open.length === cfg.pairs.length ? [] : cfg.pairs.map((_, k) => k)
  else if (op === 'sel') { s.sel = s.sel === i ? null : i; s.checked = false }
  else if (op === 'put') { if (s.sel == null) return; s.place[s.sel] = i; s.sel = null; s.checked = false }
  else if (op === 'drop') { const [it, bin] = arg.split(','); if (+bin < 0) delete s.place[+it]; else s.place[+it] = +bin; s.sel = null; s.checked = false }
  else if (op === 'check') s.checked = true
  else if (op === 'ml') { s.sel = i; s.bad = null }
  else if (op === 'mr') { if (s.sel == null) return toast('Chọn một khái niệm bên trái trước'); if (s.sel === i) { s.done[s.sel] = i; s.sel = null; s.bad = null } else { s.bad = i; setTimeout(() => { if (DM[key]) { DM[key].bad = null; dmRedraw(key) } }, 700) } }
  else if (op === 'spin') { const n = cfg.names.length; const pick = Math.floor(Math.random() * n); const target = s.rot + 1440 + (360 - ((pick + .5) * 360 / n) - (s.rot % 360) + 360) % 360
    s.spinning = true; s.picked = null; const w = document.getElementById('wh-' + key); if (w) { w.style.transition = 'transform 3s cubic-bezier(.17,.67,.2,1)'; w.style.transform = `rotate(${target}deg)` }
    const b = document.querySelector(`[data-dm="${CSS.escape(key)}|spin"]`); if (b) b.disabled = true
    setTimeout(() => { s.rot = target; s.picked = pick; s.spinning = false; dmRedraw(key) }, 3050); return }
  else if (op === 'sw') s.on = !s.on
  else if (op === 'sw2') s.on2 = !s.on2
  else if (op === 'planet') s.sel = i
  else if (op === 'tk') { s.k = i; s.T = cfg.items[i][1] }
  else if (op === 'rk') { s.k = i; s.ans = ''; s.res = null }
  else if (op === 'rcheck') s.res = Math.abs(parseFloat(String(s.ans).replace(',', '.')) - cfg.items[s.k][1]) < 0.15
  else if (op === 'sk') s.on = s.on.includes(i) ? s.on.filter(x => x !== i) : [...s.on, i]
  else if (op === 'tare') s.tare = s.on.reduce((x, k) => x + cfg.items[k][1], 0)
  dmRedraw(key); if (a.engine === 'race' && DM[key]?.phase === 'q' && DM[key].pick == null) dmTimer(key)
}
if (!window.__dm) { window.__dm = true
  document.addEventListener('click', e => { const b = e.target.closest('[data-dm]'); if (!b || b.disabled) return; if (e.target.closest('[data-dm]') !== b) return
    const [k, op, arg] = b.dataset.dm.split('|'); e.stopPropagation(); dmAct(k, op, arg) })
  document.addEventListener('input', e => { const r = e.target.closest('[data-dmr]'); if (r) { const [k, f] = r.dataset.dmr.split('|'); const s = DM[k]; if (!s) return; s[f] = +r.value; if (f === 'T') s.k = null
      const lab = r.closest('.dm-rng')?.querySelector('b'); if (lab) lab.textContent = r.value + ' ' + lab.textContent.split(' ').pop(); const o = document.querySelector(`[data-demo="${CSS.escape(k)}"] .dm-out`); if (o) o.innerHTML = dmOut(k) }
    const v = e.target.closest('[data-dmv]'); if (v) { const [k, f] = v.dataset.dmv.split('|'); if (DM[k]) DM[k][f] = v.value } })
  document.addEventListener('dragstart', e => { const t = e.target.closest?.('[data-dmdrag]'); if (t) e.dataTransfer.setData('text/plain', t.dataset.dmdrag) })
  document.addEventListener('dragover', e => { if (e.target.closest?.('[data-dmbin]')) e.preventDefault() })
  document.addEventListener('drop', e => { const bin = e.target.closest?.('[data-dmbin]'); if (!bin) return; e.preventDefault(); const d = e.dataTransfer.getData('text/plain'); if (!d) return
    const [k, it] = d.split('|'); const [k2, j] = bin.dataset.dmbin.split('|'); if (k === k2) dmAct(k, 'drop', it + ',' + j) })
}

// ---------- Tùy chỉnh cấu hình (GV) ----------
const lines = t => String(t).split('\n').map(x => x.trim()).filter(Boolean)
export function cfgForm(a, c) {
  const ta = (k, val, rows, ph) => `<textarea data-cf="${k}" rows="${rows}" placeholder="${ph}">${esc(val)}</textarea>`
  const num = (k, lab, min, max, step = 1) => `<label class="fld"><span>${lab}</span><input type="number" data-cf="${k}" min="${min}" max="${max}" step="${step}" value="${c[k]}"></label>`
  const e = a.engine
  if (e === 'race') return `<div class="cf2">${num('time', 'Thời gian mỗi câu (giây)', 5, 120)}<label class="fld"><span>Số làn đua</span><select data-cf="lanes">${[2, 3, 4].map(n => `<option ${c.lanes === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <label class="fld"><span>Bộ câu hỏi — mỗi dòng: Câu hỏi | Đáp án đúng | Sai 1 | Sai 2</span>${ta('qs', c.qs.map(q => q.join(' | ')).join('\n'), 6, 'Câu hỏi | Đúng | Sai | Sai')}</label>`
  if (e === 'flip' || e === 'match') return `<label class="fld"><span>${e === 'flip' ? 'Danh sách thẻ — mỗi dòng: Mặt trước = Mặt sau' : 'Danh sách cặp — mỗi dòng: Khái niệm = Ví dụ'}</span>${ta('pairs', c.pairs.map(p => p.join(' = ')).join('\n'), 6, 'A = B')}</label>`
  if (e === 'sort') return `<div class="cf2"><label class="fld"><span>Nhóm 1</span><input data-cf="bin0" value="${esc(c.bins[0])}"></label><label class="fld"><span>Nhóm 2</span><input data-cf="bin1" value="${esc(c.bins[1])}"></label></div>
    <label class="fld"><span>Vật cần phân loại — mỗi dòng: Tên vật = 1 hoặc 2</span>${ta('items', c.items.map(([n, b]) => `${n} = ${b + 1}`).join('\n'), 6, 'Dây đồng = 1')}</label>`
  if (e === 'wheel') return `<label class="fld"><span>Danh sách học sinh — mỗi dòng một tên</span>${ta('names', c.names.join('\n'), 6, 'Họ tên')}</label>`
  if (e === 'series' || e === 'parallel') return `<div class="cf2">${num('U', 'Hiệu điện thế ban đầu (V)', 1, 12, .1)}${num('R', 'Điện trở mỗi bóng (Ω)', 1, 20, .1)}</div>`
  if (e === 'pendulum') return `<div class="cf2">${num('L', 'Chiều dài dây ban đầu (m)', .2, 2, .05)}</div>`
  if (e === 'orbit') return `<div class="cf2">${num('speed', 'Tốc độ xem mặc định (×)', .25, 4, .25)}</div>`
  if (e === 'lever') return `<div class="cf2">${num('m1', 'm₁ (kg)', 1, 6)}${num('d1', 'd₁ (ô)', 1, 10)}${num('m2', 'm₂ (kg)', 1, 6)}${num('d2', 'd₂ (ô)', 1, 10)}</div>`
  const u = { ruler: 'cm', scale: 'g', thermo: '°C' }[e]
  return `<label class="fld"><span>Danh sách — mỗi dòng: Tên = số (${u})</span>${ta('items', c.items.map(p => p.join(' = ')).join('\n'), 5, 'Tên = số')}</label>`
}
export function readCfg(a, c) {
  const v = k => document.querySelector(`[data-cf="${k}"]`)?.value ?? ''; const e = a.engine; const n = c
  const kv = t => lines(t).map(l => l.split('=').map(x => x.trim())).filter(p => p[0] && p[1] != null)
  if (e === 'race') { n.time = Math.max(5, +v('time') || 20); n.lanes = +v('lanes') || 3; const qs = lines(v('qs')).map(l => l.split('|').map(x => x.trim())).filter(q => q.length >= 3 && q.every(Boolean)); if (qs.length) n.qs = qs }
  if (e === 'flip' || e === 'match') { const p = kv(v('pairs')); if (p.length >= 2) n.pairs = p }
  if (e === 'sort') { n.bins = [v('bin0') || 'Nhóm 1', v('bin1') || 'Nhóm 2']; const p = kv(v('items')).map(([x, b]) => [x, +b === 2 ? 1 : 0]); if (p.length) n.items = p }
  if (e === 'wheel') { const p = lines(v('names')); if (p.length >= 2) n.names = p }
  if (['series', 'parallel'].includes(e)) { n.U = +v('U') || n.U; n.R = +v('R') || n.R }
  if (e === 'pendulum') n.L = +v('L') || n.L
  if (e === 'orbit') n.speed = +v('speed') || n.speed
  if (e === 'lever') for (const k of ['m1', 'd1', 'm2', 'd2']) n[k] = +v(k) || n[k]
  if (['ruler', 'scale', 'thermo'].includes(e)) { const p = kv(v('items')).map(([x, y]) => [x, parseFloat(y.replace(',', '.'))]).filter(p => !isNaN(p[1])); if (p.length) n.items = p }
  return n
}

export function actCard(a) { const [kn, ki] = AKIND[a.kind]
  return `<button type="button" class="acard" data-aopen="${a.id}"><span class="aart">${ART[a.art]}</span><span class="abody"><b>${esc(a.title)}</b><small>${esc(a.subj.join(' · '))}</small>
    <span class="achips"><span class="achip">${ic(ki)} ${kn}</span><span class="achip">${gradeTxt(a.grades)}</span></span><span class="amore">Xem chi tiết ${ic('chev')}</span></span></button>` }
export const cfgSummary = (a, c) => a.engine === 'race' ? `${c.qs.length} câu · ${c.time}s/câu · ${c.lanes} làn` : c.pairs ? `${c.pairs.length} thẻ` : c.items ? `${c.items.length} mục` : c.names ? `${c.names.length} tên` : 'cấu hình riêng'