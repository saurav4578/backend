const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @desc    Ask AI Chatbot
// @route   POST /api/ai/chat
// @access  Private
router.post('/chat', protect, async (req, res) => {
  const { message, history, context } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ 
      success: true, 
      reply: "Please add your GEMINI_API_KEY to the backend .env file to use the AI teacher!" 
    });
  }

  try {
    const lectureTitle = context?.lectureTitle || "General/Not specified";
    const courseName = context?.courseName || "General/Not specified";
    const moduleName = context?.moduleName || "General/Not specified";

    const systemPrompt = `You are an AI tutor integrated inside a Learning Management System (LMS).

Context:
- The student is currently watching a lecture.
- Lecture Title: ${lectureTitle}
- Course Name: ${courseName}
- Module Name: ${moduleName}

Instructions:
1. Answer in a simple and easy-to-understand way.
2. STRICT RULE: Keep your ENTIRE response very short, strictly under 100 words. Do not exceed this limit under any circumstances.
3. Explain step-by-step if the question is technical, but keep it brief.
4. Use a very short example if needed.
5. If the question is unrelated to the lecture, politely say it's outside the current topic and still try to help briefly.
6. Do not use overly complex language.
7. If coding related, provide code in proper format.

Output Format:
- Short Explanation
- Brief Example (if needed)
- 1-line Summary`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt
    });

    let geminiHistory = [];
    if (history && Array.isArray(history)) {
      // Map frontend history to Gemini format
      let rawHistory = history.map(msg => ({
        role: msg.isBot ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

      // Ensure the history starts with a 'user' message
      while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
        rawHistory.shift();
      }

      // Ensure strict alternation between 'user' and 'model'
      let expectedRole = 'user';
      for (const msg of rawHistory) {
        if (msg.role === expectedRole) {
          geminiHistory.push(msg);
          expectedRole = expectedRole === 'user' ? 'model' : 'user';
        } else if (geminiHistory.length > 0) {
          // Combine consecutive messages of the same role
          geminiHistory[geminiHistory.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
        }
      }

      // Keep only the most recent 6 messages to save tokens
      if (geminiHistory.length > 6) {
        geminiHistory = geminiHistory.slice(-6);
        // If slicing made it start with 'model', remove that first 'model' message
        if (geminiHistory[0].role === 'model') {
          geminiHistory.shift();
        }
      }
    }

    const chat = model.startChat({
      history: geminiHistory
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ 
      success: false, 
      message: 'Sorry, I am having trouble connecting to my brain right now. Please try again later.' 
    });
  }
});

module.exports = router;
