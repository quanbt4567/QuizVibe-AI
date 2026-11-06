import { AIQuizRequest } from './types.js';

/**
 * Builds the standardized system prompt and user prompt for quiz generation.
 */
export function buildQuizPrompts(req: AIQuizRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `Bạn là chuyên gia thiết kế nội dung minigame trắc nghiệm quảng bá cho Fanpage thương mại.
Nhiệm vụ: Tạo đúng 5 câu hỏi trắc nghiệm tiếng Việt hấp dẫn, kích thích tương tác cho khách hàng phù hợp với ngành hàng và chủ đề được yêu cầu.

QUY TẮC BẮT BUỘC:
1. Tạo CHÍNH XÁC 5 câu hỏi. Không được ít hơn hoặc nhiều hơn.
2. Mỗi câu hỏi phải có CHÍNH XÁC 4 lựa chọn trả lời (options).
3. Mỗi câu hỏi phải có đúng 1 đáp án đúng, được chỉ định qua "correctIndex" (số nguyên từ 0 đến 3).
4. Các phương án trả lời phải ngắn gọn, súc tích, thực tế và dễ đọc trên điện thoại.
5. Giải thích ngắn gọn (explanation) dưới 100 ký tự.
6. Nội dung câu hỏi và đáp án phải bám sát ngành hàng (hỗ trợ cả các ngành hàng phổ biến lẫn ngành hàng tùy chỉnh/ngách do người dùng nhập như Đồ chơi trẻ em, Nội thất, Nông sản sạch, Dịch vụ thú y, v.v.), chủ đề và đối tượng mục tiêu.
7. Trả về định dạng JSON thuần túy theo cấu trúc sau:
{
  "questions": [
    {
      "question": "Nội dung câu hỏi?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "correctIndex": 0,
      "explanation": "Lý do vì sao đáp án này đúng."
    }
  ]
}`;

  const userPrompt = `Ngành hàng: ${req.industry}
Chủ đề minigame: ${req.topic}
Độ khó yêu cầu: ${req.difficulty}

Hãy tạo 5 câu hỏi trắc nghiệm tương ứng.`;

  return { systemPrompt, userPrompt };
}

