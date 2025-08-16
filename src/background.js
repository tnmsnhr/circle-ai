// Background script for Circle AI Assistant
chrome.runtime.onInstalled.addListener(() => {
  console.log('Circle AI Assistant installed');
});

// AI Configuration - Choose your preferred service
const AI_CONFIG = {
  // OpenAI Configuration
  openai: {
    apiKey: '', // Add your OpenAI API key here
    model: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1'
  },
  
  // Google Gemini Configuration
  gemini: {
    apiKey: '', // Add your Google AI API key here
    model: 'gemini-1.5-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  },
  
  // Choose your AI service: 'openai', 'gemini', or 'simulated'
  activeService: 'simulated'
};

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_INFO') {
    // Handle AI extraction request
    handleAIExtraction(request.data, sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleAIExtraction(data, sendResponse) {
  try {
    let response;
    
    switch (AI_CONFIG.activeService) {
      case 'openai':
        response = await callOpenAI(data);
        break;
      case 'gemini':
        response = await callGemini(data);
        break;
      default:
        response = await simulateAIResponse(data);
    }
    
    sendResponse({ success: true, data: response });
  } catch (error) {
    console.error('AI extraction error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// OpenAI Integration
async function callOpenAI(data) {
  if (!AI_CONFIG.openai.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = createAIPrompt(data);
  
  const response = await fetch(`${AI_CONFIG.openai.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that analyzes content from web pages. Provide concise, helpful analysis with summaries, insights, and actionable suggestions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  return parseAIResponse(result.choices[0].message.content);
}

// Google Gemini Integration
async function callGemini(data) {
  if (!AI_CONFIG.gemini.apiKey) {
    throw new Error('Google AI API key not configured');
  }

  const prompt = createAIPrompt(data);
  
  const response = await fetch(`${AI_CONFIG.gemini.baseURL}/models/${AI_CONFIG.gemini.model}:generateContent?key=${AI_CONFIG.gemini.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are an AI assistant that analyzes content from web pages. Provide concise, helpful analysis with summaries, insights, and actionable suggestions.

${prompt}`
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.3
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Google AI API error: ${response.status}`);
  }

  const result = await response.json();
  return parseAIResponse(result.candidates[0].content.parts[0].text);
}

// Create AI prompt based on content type
function createAIPrompt(data) {
  const { type, content, boundingBox } = data;
  
  let prompt = `Analyze the following content that was selected from a web page:

Content Type: ${type}
Content: "${content}"

Please provide:
1. A brief summary (2-3 sentences)
2. Key insights or important points
3. 2-3 actionable suggestions or recommendations

Format your response as JSON with the following structure:
{
  "summary": "Brief summary here",
  "analysis": "Key insights here",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

  if (type === 'image' && data.imageData) {
    prompt += `\n\nNote: This appears to be an image. If you can analyze the image content, please do so. Otherwise, provide general guidance about image analysis.`;
  }

  return prompt;
}

// Parse AI response into structured format
function parseAIResponse(responseText) {
  try {
    // Try to parse as JSON first
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Analysis completed',
        analysis: parsed.analysis || 'Content analyzed successfully',
        suggestions: parsed.suggestions || ['Review the selected content', 'Consider the context']
      };
    }
  } catch (e) {
    console.warn('Failed to parse AI response as JSON, using fallback');
  }

  // Fallback: extract information from text response
  const lines = responseText.split('\n').filter(line => line.trim());
  return {
    summary: lines[0] || 'Content analyzed',
    analysis: lines.slice(1, 3).join(' ') || 'Analysis completed',
    suggestions: lines.slice(3, 6).map(line => line.replace(/^[-*]\s*/, '')) || ['Review the content', 'Consider context']
  };
}

// Enhanced content extraction with OCR for images
async function extractTextFromImage(imageData) {
  // For real OCR, you could integrate with:
  // - Google Cloud Vision API
  // - Azure Computer Vision
  // - Tesseract.js (client-side)
  
  // For now, return a placeholder
  return "Image content detected. For full OCR analysis, integrate with Google Cloud Vision or Azure Computer Vision.";
}

// Simulated AI response (fallback)
async function simulateAIResponse(data) {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Enhanced mock responses based on content
  if (data.type === 'text') {
    const content = data.content;
    const wordCount = content.split(' ').length;
    
    return {
      summary: `Selected text contains ${wordCount} words: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      analysis: `This appears to be ${wordCount > 50 ? 'substantial' : 'brief'} text content. Key themes include: ${extractKeyWords(content)}`,
      suggestions: [
        "Highlight important phrases for better understanding",
        "Consider the context and source of this information",
        "Look for actionable insights or key takeaways"
      ]
    };
  } else if (data.type === 'image') {
    return {
      summary: "An image has been detected in the selected area.",
      analysis: "The image appears to be visual content. For detailed analysis, consider using OCR services like Google Cloud Vision or Azure Computer Vision to extract text from images.",
      suggestions: [
        "Use OCR to extract text from the image",
        "Analyze image content for objects and scenes",
        "Consider the image's context and purpose"
      ]
    };
  } else {
    return {
      summary: "Mixed content detected in the selected area.",
      analysis: "The selection contains various types of content that can be analyzed. Consider breaking it down into individual elements for more detailed analysis.",
      suggestions: [
        "Break down into individual text and image elements",
        "Focus on specific content types for targeted analysis",
        "Consider the overall context and purpose"
      ]
    };
  }
}

// Helper function to extract key words
function extractKeyWords(text) {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  words.forEach(word => {
    if (word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  const sortedWords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([word]) => word);
    
  return sortedWords.join(', ');
}
