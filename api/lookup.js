export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ POST" });
  }

  const { word, folders } = req.body || {};
  if (!word || typeof word !== "string" || !word.trim()) {
    return res.status(400).json({ error: "Thiếu từ cần tra" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server chưa cấu hình GEMINI_API_KEY" });
  }

  const availableFolders = Array.isArray(folders) && folders.length > 0 
    ? folders.filter(f => f !== "Tất cả").join(", ") 
    : "Chung, Tướng, Kỹ năng";

  const systemInstruction = `Bạn là trợ lý tra cứu từ vựng tiếng Trung chuyên về game Liên Minh Huyền Thoại.
Hãy chọn một thư mục phù hợp trong danh sách: [${availableFolders}]. Nếu không khớp, chọn "Chung".
Trả lời DUY NHẤT một đối tượng JSON hợp lệ, không kèm markdown, theo định dạng:
{"pinyin": "...", "meaning": "...", "note": "...", "folder": "..."}`;

  try {
    // Dùng endpoint chuẩn của gemini-1.5-flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemInstruction}\n\nTừ cần tra: ${word.trim()}` }
            ]
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: "Lỗi từ Google API", detail: data?.error?.message || JSON.stringify(data) });
    }

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return res.status(502).json({ error: "Không nhận được nội dung từ AI" });
    }

    // Làm sạch chuỗi JSON nếu AI lỡ bọc trong markdown
    const cleanJson = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json({
      pinyin: parsed.pinyin || "",
      meaning: parsed.meaning || "",
      note: parsed.note || "",
      folder: parsed.folder || "Chung",
    });
  } catch (e) {
    return res.status(500).json({ error: "Lỗi xử lý server", detail: String(e) });
  }
}
