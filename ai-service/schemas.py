from pydantic import BaseModel
from typing import Optional


class KnowledgeUnitInput(BaseModel):
    id: str
    topic: str
    concept: str
    sourceExcerpt: str
    bloomLevel: str = "REMEMBER"


class ProcessDocumentRequest(BaseModel):
    fileUrl: Optional[str] = None
    fileName: str
    documentId: str
    textContent: Optional[str] = None


class KnowledgeUnitOutput(BaseModel):
    topic: str
    concept: str
    sourceExcerpt: str
    bloomLevel: str


class ProcessDocumentResponse(BaseModel):
    knowledgeUnits: list[KnowledgeUnitOutput]


class SocraticStartRequest(BaseModel):
    documentId: str
    knowledgeUnits: list[KnowledgeUnitInput]


class SocraticStartResponse(BaseModel):
    question: str
    bloomLevel: str


class ConversationTurn(BaseModel):
    role: str
    content: str
    bloomLevel: str


class SocraticRespondRequest(BaseModel):
    sessionId: str
    studentResponse: str
    conversationHistory: list[ConversationTurn]
    currentBloomLevel: str


class SocraticRespondResponse(BaseModel):
    response: str
    bloomLevel: str
    isSessionComplete: bool


class QuizGenerateRequest(BaseModel):
    documentId: str
    knowledgeUnits: list[KnowledgeUnitInput]
    count: int = 10


class QuizQuestionOutput(BaseModel):
    knowledgeUnitId: str
    questionText: str
    options: list[str]
    correctIndex: int
    bloomLevel: str
    explanation: str
    sourceExcerpt: str


class FlashcardGenerateRequest(BaseModel):
    knowledgeUnits: list[KnowledgeUnitInput]


class FlashcardOutput(BaseModel):
    knowledgeUnitId: str
    front: str
    back: str
    sourceExcerpt: str


# ─── Performance Analysis ──────────────────────────────────────────────────

class QuestionResult(BaseModel):
    questionText: str
    studentAnswer: Optional[str] = None
    correctAnswer: Optional[str] = None
    correct: bool


class PerformanceSuggestion(BaseModel):
    topic: str
    suggestion: str
    priority: str  # "high", "medium", "low"


class AnalyzePerformanceRequest(BaseModel):
    type: str  # "quiz" or "assignment"
    title: str
    scorePercent: Optional[float] = None
    questionResults: Optional[list[QuestionResult]] = None
    instructorComments: Optional[str] = None
    courseContext: Optional[str] = None


class AnalyzePerformanceResponse(BaseModel):
    summary: str
    weakTopics: list[str]
    suggestions: list[PerformanceSuggestion]
    encouragement: str
