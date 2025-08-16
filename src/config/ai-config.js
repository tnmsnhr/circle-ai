// AI Configuration for Circle AI Assistant
// Copy this file to ai-config.local.js and add your API keys

export const AI_CONFIG = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '', // Add your OpenAI API key here
    model: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1'
  },
  
  // Google Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '', // Add your Google AI API key here
    model: 'gemini-1.5-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  },
  
  // Choose your AI service: 'openai', 'gemini', or 'simulated'
  activeService: 'simulated',
  
  // OCR Configuration (for image text extraction)
  ocr: {
    // Google Cloud Vision API
    googleVision: {
      apiKey: process.env.GOOGLE_VISION_API_KEY || '',
      enabled: false
    },
    
    // Azure Computer Vision
    azureVision: {
      endpoint: process.env.AZURE_VISION_ENDPOINT || '',
      apiKey: process.env.AZURE_VISION_API_KEY || '',
      enabled: false
    }
  }
};

// Instructions for setup:
// 1. Get API keys from:
//    - OpenAI: https://platform.openai.com/api-keys
//    - Google AI: https://makersuite.google.com/app/apikey
//    - Google Cloud Vision: https://console.cloud.google.com/apis/credentials
//    - Azure Computer Vision: https://portal.azure.com/#create/Microsoft.CognitiveServicesComputerVision
//
// 2. Set your preferred service:
//    AI_CONFIG.activeService = 'openai'; // or 'gemini'
//
// 3. Add your API keys:
//    AI_CONFIG.openai.apiKey = 'your-openai-api-key';
//    AI_CONFIG.gemini.apiKey = 'your-gemini-api-key';
