// Vercel serverless function — gọi Gemini API, key được giữ bí mật phía server.
// Đặt biến môi trường GEMINI_API_KEY trong Vercel dashboard (không ghi trực tiếp ở đây).
// Lấy API key tại: https://aistudio.google.com/apikey

const CATEGORIES = [
  "Tên tướng",
  "Kỹ năng / Chiêu thức",
  "Vai trò / Lối chơi",
  "Trang bị / Vật phẩm",
  "Thuật ngữ trận đấu",
  "Từ vựng chung",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Chỉ hỗ trợ POST" });
    return;
  }

  const { word } = req.body || {};
  if (!word || typeof word !== "string" || !word.trim()) {
    res.status(400).json({ error: "Thiếu từ cần tra" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server chưa cấu hình GEMINI_API_KEY" });
    return;
  }

  const system = `Bạn là trợ lý tra cứu từ vựng tiếng Trung chuyên về game Liên Minh Huyền Thoại (LMHT / League of Legends).
Người dùng sẽ đưa ra một từ hoặc cụm từ tiếng Trung (có thể là thuật ngữ trong game, tên tướng, kỹ năng, hoặc từ vựng thông thường).
Trả lời DUY NHẤT một đối tượng JSON hợp lệ theo đúng định dạng:
{"pinyin": "...", "meaning": "...", "note": "...", "category": "..."}
- "pinyin": phiên âm pinyin có dấu thanh của từ.
- "meaning": nghĩa tiếng Việt, ngắn gọn, súc tích. Nếu từ có liên quan đến LMHT (thuật ngữ game, tên tướng, lối chơi, vị trí, chiêu thức...) hãy ưu tiên nghĩa trong ngữ cảnh đó.
- "note": ghi chú thêm ngắn gọn (cách dùng, ví dụ trong game, hoặc phân biệt với từ dễ nhầm), có thể để chuỗi rỗng nếu không cần thiết.
- "category": chọn CHÍNH XÁC một trong các nhóm sau (viết đúng nguyên văn, không tự đặt tên khác): ${CATEGORIES.map((c) => `"${c}"`).join(", ")}.
  Nếu từ không thuộc rõ về LMHT (từ vựng tiếng Trung thông thường), chọn "Từ vựng chung".`;

  try {
    const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\nTừ cần tra: ${word.trim()}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Lỗi gọi API Gemini", detail: errText });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "Không có phản hồi văn bản từ model" });
      return;
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    res.status(200).json({
      pinyin: parsed.pinyin || "",
      meaning: parsed.meaning || "",
      note: parsed.note || "",
      category: CATEGORIES.includes(parsed.category) ? parsed.category : "Từ vựng chung",
    });
  } catch (e) {
    res.status(500).json({ error: "Lỗi xử lý tra cứu", detail: String(e) });
  } 
}
