# Multiple Follow-ups Support

## Overview

The system now supports **unlimited follow-up conversations**. The AI maintains full context of the entire conversation history and can continue asking questions until it has enough information or the user is satisfied.

## How It Works

### Conversation Flow

```
Initial Feedback (Turn 0)
    ↓
Follow-up 1 (Turn 1)
    ↓
Follow-up 2 (Turn 2)
    ↓
Follow-up 3 (Turn 3)
    ↓
... (can continue indefinitely)
    ↓
Conversation Complete
```

### Backend Changes

**Updated Endpoint:** `POST /submit_followup`

**New Request Format:**
```javascript
FormData {
  score: "5",
  conversation_history: JSON.stringify({
    initial_transcription: "The service was slow...",
    turns: [
      { user: "The checkout was slow", ai: "Could you tell me more about the checkout?" },
      { user: "It took 5 minutes", ai: "Was it the payment processing or something else?" },
      // ... more turns
    ]
  }),
  audio_data: File
}
```

**Key Improvements:**
- Accepts full conversation history (not just previous turn)
- AI sees entire conversation context
- Can make informed decisions about continuing or ending

### Frontend Changes

**Conversation History Structure:**
```javascript
[
  {
    type: "initial",
    score: 5,
    transcription: "The service was slow...",
    aiResponse: "I'm sorry to hear that...",
    sentiment: "Negative",
    feedback: ["Slow service"]
  },
  {
    type: "followup",
    transcription: "The checkout was slow",
    aiResponse: "Could you tell me more about the checkout?"
  },
  {
    type: "followup",
    transcription: "It took 5 minutes",
    aiResponse: "Was it the payment processing or something else?"
  }
  // ... can continue
]
```

**UI Features:**
- Shows follow-up counter (Follow-up #1, #2, #3, etc.)
- Warning after 3+ follow-ups to keep responses brief
- Full conversation history displayed chronologically

## Prompt Updates

### Enhanced Follow-up Prompt

The prompt now includes:
1. **Initial Feedback Context:**
   - Original NPS score
   - Initial user transcription

2. **Full Conversation History:**
   - All previous turns with user responses and AI questions
   - Maintains context across multiple exchanges

3. **Smart Decision Making:**
   - After 3-4 follow-ups, AI tries to close gracefully
   - Considers entire conversation when deciding to continue
   - Avoids repetitive questions

## Example Conversation

### Turn 0: Initial Feedback
- **User:** "The service was slow" (Score: 5/10)
- **AI:** "I'm sorry to hear that. Could you tell me more about what was slow?"

### Turn 1: First Follow-up
- **User:** "The checkout process"
- **AI:** "Thank you. Was it the payment processing or the item selection that was slow?"

### Turn 2: Second Follow-up
- **User:** "The payment part took forever"
- **AI:** "I understand. Did you experience any errors, or was it just taking a long time?"

### Turn 3: Third Follow-up
- **User:** "No errors, just very slow"
- **AI:** "Thank you for those details. We'll look into improving our payment processing speed. Is there anything else we can help you with?"

### Turn 4: Conversation Complete
- **User:** "No, that's all"
- **AI:** "Thank you for your feedback! We really appreciate you taking the time to help us improve."

## Benefits

1. **Full Context:** AI remembers everything from the conversation
2. **No Limit:** Can handle as many follow-ups as needed
3. **Smart Closing:** AI knows when to gracefully end the conversation
4. **Better Responses:** Context-aware responses improve with each turn
5. **User Experience:** Clear indicators of conversation progress

## Testing Multiple Follow-ups

1. **Start with low score (0-6):**
   - Should always ask first follow-up

2. **Give partial answers:**
   - AI should ask for more details
   - Continue until it has enough information

3. **Check conversation history:**
   - All turns should be visible
   - Follow-up counter should increment

4. **Test graceful closing:**
   - After 3-4 follow-ups, AI should try to close
   - Even if some details are missing

## API Response Format

Each follow-up response includes:
```json
{
  "transcription": "...",
  "conversationalResponse": "...",
  "requiresFollowUp": true/false,
  "conversationComplete": true/false,
  "score": 5
}
```

- `requiresFollowUp: true` → Continue conversation
- `conversationComplete: true` → End conversation
- Both can be true/false independently

## Best Practices

1. **Keep responses concise** after multiple follow-ups
2. **AI will close gracefully** after 3-4 turns
3. **Full context is maintained** throughout the conversation
4. **User can always provide more detail** if needed

