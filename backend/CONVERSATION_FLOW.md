# Conversation Flow Visualization

## Initial Feedback Flow

```
┌─────────────────┐
│  User selects   │
│  NPS Score      │
│  (0-10)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User records/  │
│  uploads audio  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  POST /submit_feedback          │
│  - score: int                   │
│  - audio_data: file             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Gemini AI Analysis             │
│  - Transcribe audio             │
│  - Analyze sentiment            │
│  - Extract feedback points      │
│  - Generate response            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Response:                      │
│  {                              │
│    "transcription": "...",      │
│    "sentiment": "...",          │
│    "feedback": ["..."],         │
│    "conversationalResponse":    │
│      "I'm sorry to hear...",    │
│    "requiresFollowUp": true     │
│  }                              │
└────────┬────────────────────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌──────────────┐   ┌──────────────┐
│ requiresFollow│   │ requiresFollow│
│ Up: false    │   │ Up: true     │
│              │   │              │
│ Show thank   │   │ Show follow- │
│ you message  │   │ up UI        │
│ END          │   │              │
└──────────────┘   └──────┬───────┘
                          │
                          ▼
```

## Follow-up Conversation Flow

```
┌─────────────────────────────────┐
│  User sees follow-up question   │
│  "Could you tell me more..."    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  User records/  │
│  uploads        │
│  follow-up      │
│  audio          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  POST /submit_followup          │
│  - conversation_id: string      │
│  - audio_data: file             │
│  - previous_context: {          │
│      score, transcription,      │
│      sentiment, feedback        │
│    }                            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Gemini AI Follow-up Analysis   │
│  - Transcribe new audio         │
│  - Understand context           │
│  - Generate appropriate         │
│    follow-up response           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Response:                      │
│  {                              │
│    "transcription": "...",      │
│    "conversationalResponse":    │
│      "Thank you for that...",   │
│    "requiresFollowUp": false,   │
│    "conversationComplete": true │
│  }                              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Show final response            │
│  END conversation               │
└─────────────────────────────────┘
```

## API Endpoints

### 1. Initial Feedback
**POST** `/submit_feedback`
- Input: `score` (int), `audio_data` (file)
- Output: Analysis with `requiresFollowUp` flag

### 2. Follow-up Response
**POST** `/submit_followup`
- Input: `conversation_id` (string), `audio_data` (file), `previous_context` (JSON)
- Output: Follow-up response with `conversationComplete` flag

## State Management

```
Initial State:
- conversation_id: null
- conversation_history: []
- requiresFollowUp: false

After Initial Feedback:
- conversation_id: "uuid-123"
- conversation_history: [
    { type: "initial", score: 5, transcription: "..." }
  ]
- requiresFollowUp: true

After Follow-up:
- conversation_id: "uuid-123"
- conversation_history: [
    { type: "initial", score: 5, transcription: "..." },
    { type: "followup", transcription: "..." }
  ]
- requiresFollowUp: false
- conversationComplete: true
```

