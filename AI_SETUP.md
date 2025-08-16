# AI Integration Setup Guide

This guide will help you set up real AI analysis for your Circle AI Assistant extension.

## 🚀 Quick Start (Simulated Mode)

The extension works out of the box with simulated AI responses. To test:

1. **Build and load the extension**
2. **Draw circles around content** on any webpage
3. **View the simulated analysis** in the popup

## 🤖 Real AI Integration

### Option 1: OpenAI GPT-4 (Recommended)

**Step 1: Get API Key**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up/login and create an API key
3. Copy your API key

**Step 2: Configure Extension**
1. Open `src/background.js`
2. Find the `AI_CONFIG` section
3. Update these lines:
```javascript
const AI_CONFIG = {
  openai: {
    apiKey: 'your-openai-api-key-here', // Replace with your key
    model: 'gpt-4o-mini',
    baseURL: 'https://api.openai.com/v1'
  },
  activeService: 'openai' // Change from 'simulated' to 'openai'
};
```

**Step 3: Rebuild Extension**
```bash
npm run build
```

### Option 2: Google Gemini

**Step 1: Get API Key**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy your API key

**Step 2: Configure Extension**
1. Open `src/background.js`
2. Update the configuration:
```javascript
const AI_CONFIG = {
  gemini: {
    apiKey: 'your-gemini-api-key-here', // Replace with your key
    model: 'gemini-1.5-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  },
  activeService: 'gemini' // Change to 'gemini'
};
```

**Step 3: Rebuild Extension**
```bash
npm run build
```

## 📸 Image Analysis (OCR)

For analyzing text in images, you can add OCR capabilities:

### Google Cloud Vision API

**Step 1: Set up Google Cloud**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Cloud Vision API
4. Create credentials (API key)

**Step 2: Configure OCR**
1. Add your Vision API key to the configuration
2. The extension will automatically extract text from images

### Azure Computer Vision

**Step 1: Set up Azure**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a Computer Vision resource
3. Get your endpoint and API key

**Step 2: Configure OCR**
1. Add your Azure credentials to the configuration
2. Enable Azure Vision in the settings

## 🔧 Advanced Configuration

### Custom AI Prompts

You can customize the AI prompts by editing the `createAIPrompt` function in `src/background.js`:

```javascript
function createAIPrompt(data) {
  // Customize your prompt here
  return `Your custom prompt for analyzing: ${data.content}`;
}
```

### Response Formatting

The AI responses are automatically formatted into:
- **Summary**: Brief overview of the content
- **Analysis**: Key insights and observations
- **Suggestions**: Actionable recommendations

### Error Handling

The extension includes robust error handling:
- Falls back to simulated responses if AI service fails
- Shows user-friendly error messages
- Logs detailed errors to console for debugging

## 💰 Cost Considerations

### OpenAI Pricing
- GPT-4o-mini: ~$0.15 per 1M input tokens
- Typical analysis: ~$0.001-0.01 per request

### Google Gemini Pricing
- Gemini 1.5 Flash: ~$0.075 per 1M input tokens
- Typical analysis: ~$0.0005-0.005 per request

### Google Cloud Vision
- OCR: $1.50 per 1,000 images
- Object detection: $1.50 per 1,000 images

## 🛠️ Troubleshooting

### Common Issues

**"API key not configured" error**
- Make sure you've added your API key correctly
- Check that `activeService` is set to the right service
- Rebuild the extension after making changes

**"API error" responses**
- Check your API key is valid
- Verify you have sufficient credits/quota
- Check the browser console for detailed error messages

**Slow responses**
- Consider using faster models (GPT-4o-mini vs GPT-4)
- Check your internet connection
- Monitor API usage and costs

### Debug Mode

Enable debug logging by adding this to your browser console:
```javascript
localStorage.setItem('circle-ai-debug', 'true');
```

## 🔒 Security Notes

- **Never commit API keys** to version control
- **Use environment variables** for production
- **Monitor API usage** to avoid unexpected charges
- **Consider rate limiting** for high-traffic usage

## 📝 Example Usage

Once configured, the extension will:

1. **Extract text** from selected areas
2. **Analyze content** using your chosen AI service
3. **Provide insights** about the content
4. **Suggest actions** based on the analysis

Example analysis for a news article:
```
Summary: This article discusses the latest developments in AI technology, focusing on new breakthroughs in natural language processing.

Analysis: The content appears to be a technical article with several key points about AI advancements, including specific mentions of transformer models and their applications.

Suggestions:
- Research the mentioned AI companies for investment opportunities
- Follow up on the technical developments mentioned
- Consider the implications for your industry
```

## 🎯 Next Steps

1. **Choose your AI service** and get API keys
2. **Configure the extension** with your credentials
3. **Test on various content types** (text, images, mixed)
4. **Customize prompts** for your specific use cases
5. **Monitor usage** and optimize for cost/performance

Happy analyzing! 🎉
