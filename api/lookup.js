export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Chỉ hỗ trợ POST" });
    return;
  }

  const { word, folders } = req.body || {};
  if (!word || typeof word !== "string" || !word.trim()) {
    res.status(400).json({ error: "Thiếu từ cần tra" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server chưa cấu hình GEMINI_API_KEY" });
    return;
  }

  const availableFolders = Array.isArray(folders) && folders.length > 0 
    ? folders.filter(f => f !== "Tất cả").join(", ") 
    : "Chung, Tướng, Kỹ năng";

  const systemInstruction = `Bạn là trợ lý tra cứu từ vựng tiếng Trung chuyên về game Liên Minh Huyền Thoại (LMHT / League of Legends).
Người dùng sẽ đưa ra một từ hoặc cụm từ tiếng Trung (thuật ngữ game, tên tướng, kỹ năng...).
Hãy tự động chọn một thư mục phù hợp nhất trong danh sách các thư mục hiện có của người dùng: [${availableFolders}]. Nếu không khớp cái nào, hãy chọn "Chung".
Trả lời DUY NHẤT một đối tượng JSON hợp lệ, không kèm markdown, không kèm giải thích, theo đúng định dạng:
{"pinyin": "...", "meaning": "...", "note": "...", "folder": "..."}
- "pinyin": phiên âm pinyin có dấu thanh.
- "meaning": nghĩa tiếng Việt ngắn gọn, ưu tiên ngữ cảnh LMHT.
- "note": ghi chú thêm ngắn gọn nếu cần, hoặc để chuỗi rỗng.
- "folder": tên thư mục được chọn từ danh sách trên.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemInstruction}\n\nTừ cần tra: ${word.trim()}` }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Lỗi gọi API Gemini", detail: errText });
      return;
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      res.status(502).json({ error: "Không có phản hồi từ model" });
      return;
    }

    const parsed = JSON.parse(textContent);

    res.status(200).json({
      pinyin: parsed.pinyin || "",
      meaning: parsed.meaning || "",
      note: parsed.note || "",
      folder: parsed.folder || "Chung",
    });
  } catch (e) {
    res.status(500).json({ error: "Lỗi xử lý tra cứu", detail: String(e) });
  }
}
